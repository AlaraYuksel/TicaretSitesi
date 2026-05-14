// stripe-sample-payment — küçük bir test PaymentIntent yaratır ve onaylar.
//
// Kullanım:
//
//	cd backend
//	go run ./cmd/stripe-sample-payment
//
// .env değerleri yüklü olmalı (özellikle STRIPE_SECRET_KEY).
// Stripe Customer + PaymentMethod (pm_card_visa) ile 10 TL'lik bir ödeme yapar.
// Stripe başarı olduğunda `payment_intent.succeeded` event'i tetiklenir;
// `stripe listen --forward-to localhost:8080/api/webhooks/stripe` çalışıyorsa
// backend log'unda "Stripe webhook: type=payment_intent.succeeded ..." görürsün.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

	"go-backend-projem/internal/payments"
)

func main() {
	amount := flag.Int64("amount", 1000, "tutar kuruş cinsinden (1000 = 10.00 TRY)")
	currency := flag.String("currency", "try", "para birimi")
	pmToken := flag.String("pm", "pm_card_visa", "test payment method token (pm_card_visa, pm_card_mastercard, vb.)")
	connect := flag.String("connect", "", "satıcının Connect acct_xxx ID'si (opsiyonel — destination charge için)")
	feePct := flag.Int("fee", 5, "platform komisyon yüzdesi")
	metaOrderID := flag.String("order-id", "", "metadata.marketplace_order_id (webhook'un DB güncellemesi için)")
	flag.Parse()

	secret := os.Getenv("STRIPE_SECRET_KEY")
	if secret == "" {
		log.Fatal("STRIPE_SECRET_KEY env değişkeni gerekli (.env'i kabuğa yükledin mi?)")
	}

	cli := payments.NewClient(secret, "", *feePct)

	ctx := context.Background()

	// 1) Customer oluştur — gerçek akışta lazy create yapılır.
	custID, err := cli.CreateCustomer(ctx, "sample-buyer@example.com", "Test Buyer", "+905551234567")
	if err != nil {
		log.Fatalf("CreateCustomer: %v", err)
	}
	fmt.Printf("✓ Customer oluşturuldu: %s\n", custID)

	// 2) PaymentMethod'u Customer'a bağla.
	if err := cli.AttachPaymentMethod(ctx, *pmToken, custID); err != nil {
		log.Fatalf("AttachPaymentMethod: %v", err)
	}
	fmt.Printf("✓ PaymentMethod attach edildi: %s → %s\n", *pmToken, custID)

	// 3) PaymentIntent oluştur + server-side confirm.
	params := payments.PaymentIntentParams{
		Amount:          *amount,
		Currency:        *currency,
		CustomerID:      custID,
		PaymentMethodID: *pmToken,
		Description:     "Sample payment (stripe-sample-payment)",
		OffSession:      true,
		Confirm:         true,
		Metadata: map[string]string{
			"source": "stripe-sample-payment",
		},
	}
	if *metaOrderID != "" {
		params.Metadata["marketplace_order_id"] = *metaOrderID
	}
	if *connect != "" {
		params.ConnectedAccountID = *connect
		params.ApplicationFee = cli.PlatformFeeFor(*amount)
		fmt.Printf("  → destination charge: %s, application_fee: %d kuruş\n", *connect, params.ApplicationFee)
	}

	res, err := cli.CreatePaymentIntent(ctx, params)
	if err != nil {
		log.Fatalf("CreatePaymentIntent: %v", err)
	}

	fmt.Printf("✓ PaymentIntent oluşturuldu: %s status=%s\n", res.ID, res.Status)
	fmt.Println()
	fmt.Println("Stripe Dashboard (test): https://dashboard.stripe.com/test/payments/" + res.ID)
	fmt.Println()
	if res.Status == "succeeded" {
		fmt.Println("→ payment_intent.succeeded event'i tetiklendi.")
		fmt.Println("→ `stripe listen --forward-to localhost:8080/api/webhooks/stripe` çalışıyorsa")
		fmt.Println("   backend log'unda webhook geldi mesajını görmen lazım.")
	} else {
		fmt.Printf("⚠ Beklenen status 'succeeded' değil: %s\n", res.Status)
	}
}
