package lambdart

import (
	"context"
	"log"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

// SQSRecordHandler, tek bir SQS mesajını işler. Hata dönerse mesaj SQS tarafından
// yeniden teslim edilir (terraform'da maxReceiveCount sonrası DLQ'ya düşer).
type SQSRecordHandler func(ctx context.Context, msg events.SQSMessage) error

// StartSQS, bir SQS consumer Lambda'sını başlatır (publisher, finance-worker).
//
// Terraform event source mapping'i batch_size=1 ile yapılandırılmıştır; yine de
// birden çok kayıt gelirse hepsi sırayla işlenir. Bir kayıt hata verirse o
// invocation hata döner ve ilgili mesaj(lar) yeniden işlenir.
func StartSQS(fn SQSRecordHandler) {
	lambda.Start(func(ctx context.Context, e events.SQSEvent) error {
		for _, rec := range e.Records {
			if err := fn(ctx, rec); err != nil {
				log.Printf("lambdart: SQS mesajı işlenemedi (id=%s): %v", rec.MessageId, err)
				return err
			}
		}
		return nil
	})
}
