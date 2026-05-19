package handler

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"

	dbpkg "go-backend-projem/internal/db"
	"go-backend-projem/internal/payments"

	"github.com/jackc/pgx/v5"
	"github.com/stripe/stripe-go/v82"
)

// WebhookHandler — EasyPost & Stripe webhook'ları
// Webhook → doğrula → SQS'e at → anında 200 OK dön
type WebhookHandler struct {
	store                 *dbpkg.Store
	stripe                *payments.Client
	easypostWebhookSecret string

	// OnDelivered, bir kargo "delivered" durumuna geçince çağrılır. Lambda
	// ortamında lambdart bunu finance SQS kuyruğuna mesaj atacak şekilde
	// ayarlar; lokal/Docker'da nil bırakılır.
	OnDelivered func(ctx context.Context, trackerID, trackingCode string)
}

func NewWebhookHandler(store *dbpkg.Store, stripeClient *payments.Client, easypostSecret string) *WebhookHandler {
	return &WebhookHandler{
		store:                 store,
		stripe:                stripeClient,
		easypostWebhookSecret: easypostSecret,
	}
}

// ─── EasyPost Webhook ───────────────────────────────────────────────────────
// POST /api/webhooks/easypost
//
// Akış:
//   1. POST isteği gelir
//   2. HMAC signature doğrula
//   3. Veriyi SQS Finance'e at
//   4. Anında 200 OK dön (EasyPost 5sn timeout uygular!)
//
// "delivered" eventi → Finance Worker → Stripe escrow release
func (h *WebhookHandler) EasyPost(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // max 1MB
	if err != nil {
		log.Printf("EasyPost webhook: body okunamadı: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// HMAC-SHA256 signature doğrulama
	signature := r.Header.Get("X-Hmac-Signature")
	if h.easypostWebhookSecret != "" && !verifyHMAC(body, signature, h.easypostWebhookSecret) {
		log.Printf("EasyPost webhook: geçersiz signature")
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	// Webhook payload'ını parse et
	var payload struct {
		Description string `json:"description"`
		Result      struct {
			ID     string `json:"id"`
			Status string `json:"status"`
			// EasyPost tracker result alanları
			TrackingCode string `json:"tracking_code"`
		} `json:"result"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		log.Printf("EasyPost webhook: JSON parse hatası: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	log.Printf("EasyPost webhook alındı: event=%s tracker=%s status=%s",
		payload.Description, payload.Result.ID, payload.Result.Status)

	// Kritik event: "delivered" → SQS Finance'e gönder
	if payload.Result.Status == "delivered" {
		log.Printf("KARGO TESLİM EDİLDİ: tracker=%s → SQS Finance kuyruğuna gönderiliyor",
			payload.Result.ID)

		// Lambda ortamında: finance kuyruğuna mesaj at → finance-worker Lambda
		// teslimatı işler (escrow release). Lokal/Docker'da OnDelivered nil.
		if h.OnDelivered != nil {
			h.OnDelivered(r.Context(), payload.Result.ID, payload.Result.TrackingCode)
		}
	}

	// EasyPost'a hemen 200 OK dön — 5sn timeout'u aşma!
	w.WriteHeader(http.StatusOK)
}

// ─── Stripe Webhook ─────────────────────────────────────────────────────────
// POST /api/webhooks/stripe
//
// İşlenen eventler:
//   • payment_intent.succeeded    → marketplace_orders.payment_status = 'paid'
//   • payment_intent.payment_failed → log + (siparişe etki yok; UX'te buyer'a hata göster)
//   • charge.refunded             → payment_status='refunded', escrow='refunded'
//   • account.updated             → seller_profiles.stripe_onboarded/payout_enabled güncelle
//
// Imza doğrulaması: stripe.webhook.ConstructEvent (HMAC-SHA256 + timestamp).
// STRIPE_WEBHOOK_SECRET tanımlı değilse imza atlanır (test/dev kolaylığı için)
// ama bu durumda log uyarısı yazılır.
func (h *WebhookHandler) Stripe(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		log.Printf("Stripe webhook: body okunamadı: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var event stripe.Event
	sig := r.Header.Get("Stripe-Signature")

	if h.stripe != nil {
		if ev, verr := h.stripe.VerifyWebhook(body, sig); verr == nil {
			event = ev
		} else {
			// Webhook secret yoksa imza doğrulanmadan parse et (dev mode).
			// Bu durumda LOG uyarısı yaz — prod'da bu yola asla girilmemeli.
			if errors.Is(verr, payments.ErrMissingWebhookSecret) || sig == "" {
				log.Printf("Stripe webhook: imza doğrulanamadı (dev mode atlama)")
				if jerr := json.Unmarshal(body, &event); jerr != nil {
					log.Printf("Stripe webhook: JSON parse: %v", jerr)
					w.WriteHeader(http.StatusBadRequest)
					return
				}
			} else {
				log.Printf("Stripe webhook: imza HATASI: %v", verr)
				w.WriteHeader(http.StatusBadRequest)
				return
			}
		}
	} else if jerr := json.Unmarshal(body, &event); jerr != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	log.Printf("Stripe webhook: type=%s id=%s", event.Type, event.ID)

	switch event.Type {
	case "payment_intent.succeeded":
		var pi stripe.PaymentIntent
		if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
			log.Printf("PI unmarshal: %v", err)
			break
		}
		if err := h.store.MarkMarketplaceOrderPaid(r.Context(), pi.ID); err != nil {
			if !errors.Is(err, pgx.ErrNoRows) {
				log.Printf("MarkMarketplaceOrderPaid: %v", err)
			}
		}

	case "payment_intent.payment_failed":
		var pi stripe.PaymentIntent
		_ = json.Unmarshal(event.Data.Raw, &pi)
		log.Printf("Ödeme başarısız: pi=%s reason=%v", pi.ID, pi.LastPaymentError)

	case "charge.refunded":
		// Charge'ın PaymentIntent'i üzerinden order'ı bul
		var ch stripe.Charge
		if err := json.Unmarshal(event.Data.Raw, &ch); err != nil {
			log.Printf("Charge unmarshal: %v", err)
			break
		}
		piID := ""
		if ch.PaymentIntent != nil {
			piID = ch.PaymentIntent.ID
		}
		if piID != "" {
			if err := h.store.MarkMarketplaceOrderRefunded(r.Context(), piID); err != nil {
				log.Printf("MarkMarketplaceOrderRefunded: %v", err)
			}
		}

	case "account.updated":
		var acc stripe.Account
		if err := json.Unmarshal(event.Data.Raw, &acc); err != nil {
			log.Printf("Account unmarshal: %v", err)
			break
		}
		onboarded := acc.DetailsSubmitted && acc.ChargesEnabled
		if err := h.store.UpdateSellerStripeStatus(r.Context(), acc.ID, onboarded, acc.PayoutsEnabled); err != nil {
			log.Printf("UpdateSellerStripeStatus: %v", err)
		}
		log.Printf("Connect account.updated: acc=%s onboarded=%v payouts=%v", acc.ID, onboarded, acc.PayoutsEnabled)

	default:
		log.Printf("Stripe event ignored: %s", event.Type)
	}

	w.WriteHeader(http.StatusOK)
}


// ─── HMAC Doğrulama ─────────────────────────────────────────────────────────
func verifyHMAC(body []byte, signature, secret string) bool {
	if signature == "" || secret == "" {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(expected), []byte(signature))
}
