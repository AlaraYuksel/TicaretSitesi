// ai-worker Lambda — ai-jobs SQS kuyruğunu tüketir.
//
// Bir AI işi (plan/execute/solve) ai-api tarafından kuyruğa atılır. Bu Lambda
// işi alır, handler.RunAIJob ile çalıştırır (mevcut AI mantığı yeniden kullanılır),
// ilerleme ve sonucu ai_jobs tablosuna yazar. HTTP/Function URL yok → 403 yok.
package main

import (
	"context"
	"encoding/json"
	"log"

	"go-backend-projem/internal/handler"
	"go-backend-projem/internal/lambdart"
	"go-backend-projem/internal/queue"

	"github.com/aws/aws-lambda-go/events"
)

func process(ctx context.Context, msg events.SQSMessage) error {
	var m queue.AIJobMessage
	if err := json.Unmarshal([]byte(msg.Body), &m); err != nil {
		log.Printf("ai-worker: geçersiz mesaj: %v", err)
		return nil // bozuk mesaj — retry etme
	}

	d := lambdart.MustLoad()

	job, err := d.Store.GetAIJobByID(ctx, m.JobID)
	if err != nil {
		// İş bulunamadı — altyapı hatası olabilir, SQS retry etsin.
		return err
	}

	if d.AISiteBuilder == nil || d.AISolver == nil {
		log.Printf("ai-worker: AI handler'ları kurulu değil (GEMINI_API_KEY?)")
		_ = d.Store.FinishAIJob(ctx, job.ID, "error", nil, "AI servisi yapılandırılmamış")
		return nil
	}

	// RunAIJob hataları işin içine yazar — SQS açısından her durumda başarılı.
	handler.RunAIJob(ctx, d.Store, d.AISiteBuilder, d.AISolver, job)
	return nil
}

func main() {
	lambdart.StartSQS(process)
}
