// publisher Lambda — publish SQS kuyruğunu tüketir.
//
// Bir site publish edildiğinde sites Lambda kuyruğa PublishMessage atar.
// Bu Lambda mesajı alır, siteyi DB'den okur, HTML'e render eder ve
// S3 published bucket'a {subdomain}/index.html olarak yükler.
// domain-router Lambda bu dosyayı *.iluvcode.art isteklerinde serve eder.
package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strings"

	"go-backend-projem/internal/lambdart"
	"go-backend-projem/internal/queue"
	"go-backend-projem/internal/render"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var (
	s3Client        *s3.Client
	publishedBucket string
)

func process(ctx context.Context, msg events.SQSMessage) error {
	var m queue.PublishMessage
	if err := json.Unmarshal([]byte(msg.Body), &m); err != nil {
		return err
	}

	d := lambdart.MustLoad()

	site, err := d.Store.GetSiteByID(ctx, m.SiteID, m.UserID)
	if err != nil {
		return err
	}

	sub := m.Subdomain
	if sub == "" && site.Subdomain != nil {
		sub = *site.Subdomain
	}
	if sub == "" {
		log.Printf("publisher: site %s subdomain'siz — atlanıyor", m.SiteID)
		return nil
	}

	html, err := render.GenerateHTML(site)
	if err != nil {
		return err
	}

	key := sub + "/index.html"
	_, err = s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(publishedBucket),
		Key:         aws.String(key),
		Body:        strings.NewReader(html),
		ContentType: aws.String("text/html; charset=utf-8"),
	})
	if err != nil {
		return err
	}

	log.Printf("publisher: %s yayınlandı (%d byte)", key, len(html))
	return nil
}

func main() {
	publishedBucket = os.Getenv("S3_PUBLISHED_BUCKET")
	if publishedBucket == "" {
		log.Fatal("publisher: S3_PUBLISHED_BUCKET env var gerekli")
	}

	cfg, err := awscfg.LoadDefaultConfig(context.Background())
	if err != nil {
		log.Fatalf("publisher: AWS config yüklenemedi: %v", err)
	}
	s3Client = s3.NewFromConfig(cfg)

	lambdart.StartSQS(process)
}
