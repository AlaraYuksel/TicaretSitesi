package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"net/http"

	dbpkg "go-backend-projem/internal/db"
)

// WebhookHandler — EasyPost & Stripe webhook'ları
// Webhook → doğrula → SQS'e at → anında 200 OK dön
type WebhookHandler struct {
	store               *dbpkg.Store
	stripeWebhookSecret string
	easypostWebhookSecret string
	// sqsFinanceURL       string   // SQS Finance kuyruğu (prod'da eklenir)
	// sqsNotifURL         string   // SQS Notifications kuyruğu
}

func NewWebhookHandler(store *dbpkg.Store, stripeSecret, easypostSecret string) *WebhookHandler {
	return &WebhookHandler{
		store:                 store,
		stripeWebhookSecret:   stripeSecret,
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

		// TODO (prod): SQS Finance kuyruğuna mesaj gönder
		// msg := SQSFinanceMessage{
		//     EventType:    "easypost.delivered",
		//     TrackerID:    payload.Result.ID,
		//     TrackingCode: payload.Result.TrackingCode,
		//     Timestamp:    time.Now(),
		// }
		// sqsClient.SendMessage(ctx, &sqs.SendMessageInput{
		//     QueueUrl:    &h.sqsFinanceURL,
		//     MessageBody: aws.String(marshal(msg)),
		//     MessageGroupId: aws.String(payload.Result.ID), // FIFO için
		// })
	}

	// EasyPost'a hemen 200 OK dön — 5sn timeout'u aşma!
	w.WriteHeader(http.StatusOK)
}

// ─── Stripe Webhook ─────────────────────────────────────────────────────────
// POST /api/webhooks/stripe
//
// Stripe eventleri: payment_intent.succeeded, charge.refunded, vb.
func (h *WebhookHandler) Stripe(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		log.Printf("Stripe webhook: body okunamadı: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Stripe-Signature header doğrulama
	// TODO (prod): stripe.webhook.ConstructEvent() kullan
	stripeSignature := r.Header.Get("Stripe-Signature")
	if h.stripeWebhookSecret != "" && stripeSignature == "" {
		log.Printf("Stripe webhook: signature eksik")
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	var event struct {
		Type string          `json:"type"`
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(body, &event); err != nil {
		log.Printf("Stripe webhook: JSON parse hatası: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	log.Printf("Stripe webhook alındı: type=%s", event.Type)

	switch event.Type {
	case "payment_intent.succeeded":
		// Ödeme başarılı → Sipariş durumunu güncelle
		// TODO: sqlc UpdateOrderPayment
		// TODO: SQS Notifications → alıcı + satıcıya bildirim
		log.Printf("Ödeme başarılı — sipariş güncelleniyor")

	case "payment_intent.payment_failed":
		// Ödeme başarısız → siparişi iptal et, stok geri yükle
		log.Printf("Ödeme başarısız — sipariş iptal ediliyor")

	case "charge.refunded":
		// İade → escrow refund + stok geri yükle
		log.Printf("İade işlemi — escrow refund başlatılıyor")

	default:
		log.Printf("Bilinmeyen Stripe event: %s (yoksayılıyor)", event.Type)
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
