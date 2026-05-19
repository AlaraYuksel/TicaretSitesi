// finance-worker Lambda — finance SQS kuyruğunu tüketir.
//
// Kargo "delivered" olduğunda webhooks Lambda kuyruğa FinanceMessage atar.
// Bu Lambda mesajı alır ve teslimat sonrası finansal işlemi (Stripe escrow
// release) yürütür.
//
// NOT: EasyPost webhook'u yalnızca tracker ID verir; bunu marketplace_order'a
// eşlemek için store'da bir GetOrderByTracker metodu gerekir (henüz yok).
// Eşleme eklenince teslim + escrow release burada tamamlanacaktır:
//   store.MarkMarketplaceOrderDelivered → Stripe transfer →
//   store.MarkMarketplaceOrderEscrowReleased
package main

import (
	"context"
	"encoding/json"
	"log"

	"go-backend-projem/internal/lambdart"
	"go-backend-projem/internal/queue"

	"github.com/aws/aws-lambda-go/events"
)

func process(ctx context.Context, msg events.SQSMessage) error {
	var m queue.FinanceMessage
	if err := json.Unmarshal([]byte(msg.Body), &m); err != nil {
		return err
	}

	// Bağımlılıkları (DB pool) hazırla — escrow mantığı eklendiğinde kullanılacak.
	_ = lambdart.MustLoad()

	log.Printf("finance-worker: event=%s tracker=%s kod=%s alındı",
		m.EventType, m.TrackerID, m.TrackingCode)

	// TODO: tracker → marketplace_order eşlemesi eklenince escrow release.
	return nil
}

func main() {
	lambdart.StartSQS(process)
}
