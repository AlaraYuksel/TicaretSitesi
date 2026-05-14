// Package payments Stripe (test mode) entegrasyonu için ince bir wrapper sağlar.
//
// Tasarım notu:
//   • Bu paket Stripe çağrılarını encapsulate eder; handler'lar doğrudan stripe SDK'sına
//     bağımlı olmaz, dolayısıyla testlerde mock'lamak ve gelecekte sağlayıcı değiştirmek
//     kolaylaşır.
//   • Kart hassas verisi (PAN, CVV) bu sunucuya hiç ulaşmaz: frontend Stripe Elements
//     iframe içinde kartı doğrudan Stripe'a gönderir, biz yalnızca pm_xxx token'ı işleriz.
package payments

import (
	"context"
	"errors"
	"fmt"

	"github.com/stripe/stripe-go/v82"
	"github.com/stripe/stripe-go/v82/account"
	"github.com/stripe/stripe-go/v82/accountlink"
	"github.com/stripe/stripe-go/v82/customer"
	"github.com/stripe/stripe-go/v82/paymentintent"
	"github.com/stripe/stripe-go/v82/paymentmethod"
	"github.com/stripe/stripe-go/v82/refund"
	"github.com/stripe/stripe-go/v82/setupintent"
	"github.com/stripe/stripe-go/v82/transfer"
	"github.com/stripe/stripe-go/v82/webhook"
)

// ErrNotConfigured Stripe secret key tanımlı değilse döner.
var ErrNotConfigured = errors.New("stripe yapılandırılmamış (STRIPE_SECRET_KEY eksik)")

// ErrMissingWebhookSecret webhook imza doğrulaması için secret eksikse döner.
// Caller dev modunda bunu yakalayıp imza atlamayı tercih edebilir.
var ErrMissingWebhookSecret = errors.New("STRIPE_WEBHOOK_SECRET tanımlı değil")

// Client Stripe ile etkileşim için thread-safe bir handle.
type Client struct {
	secretKey      string
	webhookSecret  string
	platformFeePct int
}

// NewClient secret key boş olursa bütün metotları ErrNotConfigured ile döndüren bir client üretir.
// Bu sayede Stripe konfigüre edilmemiş ortamda diğer feature'lar çalışmaya devam eder.
func NewClient(secretKey, webhookSecret string, platformFeePct int) *Client {
	if secretKey != "" {
		stripe.Key = secretKey
	}
	return &Client{
		secretKey:      secretKey,
		webhookSecret:  webhookSecret,
		platformFeePct: platformFeePct,
	}
}

// Configured stripe API çağrılarının kullanılabilir olup olmadığını söyler.
func (c *Client) Configured() bool { return c.secretKey != "" }

// PlatformFeeFor verilen tutara komisyonu uygular (kuruş bazında, integer çarpma).
func (c *Client) PlatformFeeFor(amount int64) int64 {
	return amount * int64(c.platformFeePct) / 100
}

// ─── Customer ──────────────────────────────────────────────────────────────

// CreateCustomer Stripe Customer oluşturur ve cus_xxx ID döndürür.
func (c *Client) CreateCustomer(ctx context.Context, email, name, phone string) (string, error) {
	if !c.Configured() {
		return "", ErrNotConfigured
	}
	params := &stripe.CustomerParams{
		Email: stripe.String(email),
	}
	if name != "" {
		params.Name = stripe.String(name)
	}
	if phone != "" {
		params.Phone = stripe.String(phone)
	}
	params.Context = ctx
	cus, err := customer.New(params)
	if err != nil {
		return "", fmt.Errorf("stripe customer oluşturulamadı: %w", err)
	}
	return cus.ID, nil
}

// ─── SetupIntent (yeni kart kaydetme) ──────────────────────────────────────

// CreateSetupIntent kayıtlı kart akışı için client_secret döndürür.
// Frontend bu secret'ı kullanarak stripe.confirmCardSetup() çağırır.
func (c *Client) CreateSetupIntent(ctx context.Context, customerID string) (clientSecret, intentID string, err error) {
	if !c.Configured() {
		return "", "", ErrNotConfigured
	}
	params := &stripe.SetupIntentParams{
		Customer:           stripe.String(customerID),
		PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
		Usage:              stripe.String("off_session"),
	}
	params.Context = ctx
	si, err := setupintent.New(params)
	if err != nil {
		return "", "", fmt.Errorf("setup intent oluşturulamadı: %w", err)
	}
	return si.ClientSecret, si.ID, nil
}

// ─── PaymentMethod ─────────────────────────────────────────────────────────

// AttachPaymentMethod var olan PaymentMethod'u (pm_xxx) Customer'a bağlar.
func (c *Client) AttachPaymentMethod(ctx context.Context, pmID, customerID string) error {
	if !c.Configured() {
		return ErrNotConfigured
	}
	params := &stripe.PaymentMethodAttachParams{
		Customer: stripe.String(customerID),
	}
	params.Context = ctx
	_, err := paymentmethod.Attach(pmID, params)
	if err != nil {
		return fmt.Errorf("payment method attach başarısız: %w", err)
	}
	return nil
}

// DetachPaymentMethod kartı Customer'dan çıkarır.
func (c *Client) DetachPaymentMethod(ctx context.Context, pmID string) error {
	if !c.Configured() {
		return ErrNotConfigured
	}
	params := &stripe.PaymentMethodDetachParams{}
	params.Context = ctx
	_, err := paymentmethod.Detach(pmID, params)
	if err != nil {
		return fmt.Errorf("payment method detach başarısız: %w", err)
	}
	return nil
}

// PaymentMethodDisplay PaymentMethod'tan gösterim için (brand/last4/exp) verilerini çeker.
type PaymentMethodDisplay struct {
	Brand    string
	Last4    string
	ExpMonth int64
	ExpYear  int64
}

// RetrievePaymentMethod PaymentMethod'un display verisini Stripe'tan getirir.
func (c *Client) RetrievePaymentMethod(ctx context.Context, pmID string) (*PaymentMethodDisplay, error) {
	if !c.Configured() {
		return nil, ErrNotConfigured
	}
	params := &stripe.PaymentMethodParams{}
	params.Context = ctx
	pm, err := paymentmethod.Get(pmID, params)
	if err != nil {
		return nil, fmt.Errorf("payment method getirilemedi: %w", err)
	}
	if pm.Card == nil {
		return nil, fmt.Errorf("kart bilgisi yok (sadece card türü destekleniyor)")
	}
	return &PaymentMethodDisplay{
		Brand:    string(pm.Card.Brand),
		Last4:    pm.Card.Last4,
		ExpMonth: pm.Card.ExpMonth,
		ExpYear:  pm.Card.ExpYear,
	}, nil
}

// ─── PaymentIntent (gerçek ödeme — destination charge) ─────────────────────

// PaymentIntentParams checkout sırasında PaymentIntent oluşturmak için.
type PaymentIntentParams struct {
	Amount             int64  // kuruş
	Currency           string // "try"
	CustomerID         string // cus_xxx (opsiyonel — guest için boş)
	PaymentMethodID    string // pm_xxx (opsiyonel — frontend confirm akışı için boş bırakılabilir)
	ConnectedAccountID string // acct_xxx — satıcının Connect hesabı
	ApplicationFee     int64  // platform komisyonu (kuruş)
	Description        string
	Metadata           map[string]string
	OffSession         bool // true → kayıtlı kart, false → kullanıcı önünde
	Confirm            bool // true → server-side confirm
}

// PaymentIntentResult oluşturulan PaymentIntent'in özetini taşır.
type PaymentIntentResult struct {
	ID           string
	ClientSecret string
	Status       string
}

// CreatePaymentIntent destination charge tarzında bir PaymentIntent oluşturur:
//   - Para önce platform hesabına gider, application_fee alıkonur,
//   - Geri kalan transfer_data.destination ile satıcıya aktarılır.
//
// ConnectedAccountID boş bırakılırsa düz ödeme yapılır (test/dev kolaylığı için).
func (c *Client) CreatePaymentIntent(ctx context.Context, p PaymentIntentParams) (*PaymentIntentResult, error) {
	if !c.Configured() {
		return nil, ErrNotConfigured
	}
	if p.Currency == "" {
		p.Currency = "try"
	}
	params := &stripe.PaymentIntentParams{
		Amount:             stripe.Int64(p.Amount),
		Currency:           stripe.String(p.Currency),
		PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
	}
	if p.Description != "" {
		params.Description = stripe.String(p.Description)
	}
	if p.CustomerID != "" {
		params.Customer = stripe.String(p.CustomerID)
	}
	if p.PaymentMethodID != "" {
		params.PaymentMethod = stripe.String(p.PaymentMethodID)
	}
	if p.OffSession {
		params.OffSession = stripe.Bool(true)
	}
	if p.Confirm {
		params.Confirm = stripe.Bool(true)
	}
	if p.ConnectedAccountID != "" {
		params.TransferData = &stripe.PaymentIntentTransferDataParams{
			Destination: stripe.String(p.ConnectedAccountID),
		}
		if p.ApplicationFee > 0 {
			params.ApplicationFeeAmount = stripe.Int64(p.ApplicationFee)
		}
	}
	for k, v := range p.Metadata {
		params.AddMetadata(k, v)
	}
	params.Context = ctx

	pi, err := paymentintent.New(params)
	if err != nil {
		return nil, fmt.Errorf("payment intent oluşturulamadı: %w", err)
	}
	return &PaymentIntentResult{ID: pi.ID, ClientSecret: pi.ClientSecret, Status: string(pi.Status)}, nil
}

// RetrievePaymentIntent Stripe'tan PaymentIntent'i çeker (status öğrenmek için).
// Webhook gelmeden önce frontend confirm tamamlandığında order'ı paid işaretlemek için kullanılır.
func (c *Client) RetrievePaymentIntent(ctx context.Context, paymentIntentID string) (*PaymentIntentResult, error) {
	if !c.Configured() {
		return nil, ErrNotConfigured
	}
	params := &stripe.PaymentIntentParams{}
	params.Context = ctx
	pi, err := paymentintent.Get(paymentIntentID, params)
	if err != nil {
		return nil, fmt.Errorf("payment intent çekilemedi: %w", err)
	}
	return &PaymentIntentResult{ID: pi.ID, ClientSecret: pi.ClientSecret, Status: string(pi.Status)}, nil
}

// ─── Refund ────────────────────────────────────────────────────────────────

// CreateRefund tüm tutarı (veya belirli tutarı) geri öder.
func (c *Client) CreateRefund(ctx context.Context, paymentIntentID string, amount int64) (string, error) {
	if !c.Configured() {
		return "", ErrNotConfigured
	}
	params := &stripe.RefundParams{
		PaymentIntent: stripe.String(paymentIntentID),
	}
	if amount > 0 {
		params.Amount = stripe.Int64(amount)
	}
	params.Context = ctx
	r, err := refund.New(params)
	if err != nil {
		return "", fmt.Errorf("refund oluşturulamadı: %w", err)
	}
	return r.ID, nil
}

// ─── Transfer (escrow release) ─────────────────────────────────────────────

// CreateTransfer escrow süresinden sonra fonu satıcının Connect hesabına aktarır.
// destination = acct_xxx, sourceTxn destination charge'tan gelen pi/ch ID.
func (c *Client) CreateTransfer(ctx context.Context, amount int64, currency, destination, sourceTxn string) (string, error) {
	if !c.Configured() {
		return "", ErrNotConfigured
	}
	if currency == "" {
		currency = "try"
	}
	params := &stripe.TransferParams{
		Amount:      stripe.Int64(amount),
		Currency:    stripe.String(currency),
		Destination: stripe.String(destination),
	}
	if sourceTxn != "" {
		params.SourceTransaction = stripe.String(sourceTxn)
	}
	params.Context = ctx
	t, err := transfer.New(params)
	if err != nil {
		return "", fmt.Errorf("transfer oluşturulamadı: %w", err)
	}
	return t.ID, nil
}

// ─── Connect Onboarding ────────────────────────────────────────────────────

// CreateExpressAccount satıcı için Connect Express hesabı oluşturur. acct_xxx döner.
func (c *Client) CreateExpressAccount(ctx context.Context, email, country string) (string, error) {
	if !c.Configured() {
		return "", ErrNotConfigured
	}
	if country == "" {
		country = "TR"
	}
	params := &stripe.AccountParams{
		Type:    stripe.String(string(stripe.AccountTypeExpress)),
		Country: stripe.String(country),
		Email:   stripe.String(email),
		Capabilities: &stripe.AccountCapabilitiesParams{
			Transfers:    &stripe.AccountCapabilitiesTransfersParams{Requested: stripe.Bool(true)},
			CardPayments: &stripe.AccountCapabilitiesCardPaymentsParams{Requested: stripe.Bool(true)},
		},
	}
	params.Context = ctx
	acc, err := account.New(params)
	if err != nil {
		return "", fmt.Errorf("connect account oluşturulamadı: %w", err)
	}
	return acc.ID, nil
}

// CreateAccountLink Stripe hosted onboarding URL'i üretir.
func (c *Client) CreateAccountLink(ctx context.Context, accountID, returnURL, refreshURL string) (string, error) {
	if !c.Configured() {
		return "", ErrNotConfigured
	}
	params := &stripe.AccountLinkParams{
		Account:    stripe.String(accountID),
		ReturnURL:  stripe.String(returnURL),
		RefreshURL: stripe.String(refreshURL),
		Type:       stripe.String("account_onboarding"),
	}
	params.Context = ctx
	link, err := accountlink.New(params)
	if err != nil {
		return "", fmt.Errorf("account link oluşturulamadı: %w", err)
	}
	return link.URL, nil
}

// AccountStatus account.updated webhook'undan satıcı durumunu okumak için.
type AccountStatus struct {
	ID               string
	ChargesEnabled   bool
	PayoutsEnabled   bool
	DetailsSubmitted bool
}

// RetrieveAccount account'un mevcut durumunu çeker.
func (c *Client) RetrieveAccount(ctx context.Context, accountID string) (*AccountStatus, error) {
	if !c.Configured() {
		return nil, ErrNotConfigured
	}
	params := &stripe.AccountParams{}
	params.Context = ctx
	acc, err := account.GetByID(accountID, params)
	if err != nil {
		return nil, fmt.Errorf("connect account getirilemedi: %w", err)
	}
	return &AccountStatus{
		ID:               acc.ID,
		ChargesEnabled:   acc.ChargesEnabled,
		PayoutsEnabled:   acc.PayoutsEnabled,
		DetailsSubmitted: acc.DetailsSubmitted,
	}, nil
}

// ─── Webhook ───────────────────────────────────────────────────────────────

// VerifyWebhook imzayı doğrular ve stripe.Event döndürür.
func (c *Client) VerifyWebhook(payload []byte, sigHeader string) (stripe.Event, error) {
	if c.webhookSecret == "" {
		return stripe.Event{}, ErrMissingWebhookSecret
	}
	return webhook.ConstructEvent(payload, sigHeader, c.webhookSecret)
}
