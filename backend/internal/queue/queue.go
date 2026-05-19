// Package queue, SQS kuyruklarına mesaj göndermek ve mesaj şemalarını paylaşmak
// için ortak yardımcılar sağlar.
//
// Akışlar:
//   - Site publish edilince → publish kuyruğu → publisher Lambda → S3'e HTML.
//   - Kargo teslim edilince  → finance kuyruğu → finance-worker Lambda → escrow.
package queue

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
)

// PublishMessage, bir site publish edildiğinde publish kuyruğuna yazılır.
// publisher Lambda bunu okuyup siteyi render eder ve S3'e yükler.
type PublishMessage struct {
	SiteID    string `json:"site_id"`
	UserID    string `json:"user_id"`
	Subdomain string `json:"subdomain"`
}

// FinanceMessage, kargo "delivered" olduğunda finance kuyruğuna yazılır.
type FinanceMessage struct {
	EventType    string `json:"event_type"`
	TrackerID    string `json:"tracker_id"`
	TrackingCode string `json:"tracking_code"`
}

// AIJobMessage, bir AI işi başlatıldığında ai-jobs kuyruğuna yazılır.
// Worker, job_id ile işin tüm detayını DB'den (ai_jobs) okur.
type AIJobMessage struct {
	JobID string `json:"job_id"`
}

// Sender, tek bir SQS kuyruğuna JSON mesaj gönderir.
type Sender struct {
	client *sqs.Client
	url    string
}

// NewSender, verilen kuyruk URL'i için bir gönderici oluşturur.
func NewSender(ctx context.Context, queueURL string) (*Sender, error) {
	if queueURL == "" {
		return nil, fmt.Errorf("queue: boş queue URL")
	}
	cfg, err := awscfg.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("queue: AWS config yüklenemedi: %w", err)
	}
	return &Sender{client: sqs.NewFromConfig(cfg), url: queueURL}, nil
}

// Send, payload'ı JSON'a çevirip kuyruğa gönderir.
func (s *Sender) Send(ctx context.Context, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = s.client.SendMessage(ctx, &sqs.SendMessageInput{
		QueueUrl:    aws.String(s.url),
		MessageBody: aws.String(string(body)),
	})
	return err
}
