package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"testing"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// mockS3Client implements S3GetObjectAPI for testing
type mockS3Client struct{}

func (m *mockS3Client) GetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
	key := *params.Key
	
	// Eğer test subdomaini "ahmet" ise ve index.html isteniyorsa başarılı dön
	if key == "ahmet/index.html" {
		htmlContent := "<html><body>Merhaba Ahmet!</body></html>"
		return &s3.GetObjectOutput{
			Body: io.NopCloser(bytes.NewReader([]byte(htmlContent))),
		}, nil
	}

	// Diğer durumlar için dosya bulunamadı hatası (AWS S3 NoSuchKey hatası simülasyonu)
	return nil, fmt.Errorf("NoSuchKey: The specified key does not exist")
}

func TestDomainRouterHandler(t *testing.T) {
	// AWS Credential hatası almamak için çevresel değişkenleri ayarla
	os.Setenv("S3_PUBLISHED_BUCKET", "mock-bucket")
	os.Setenv("DOMAIN_NAME", "iluvcode.art")
	
	// init içindeki aws config yüklemesini pas geçip manuel atama yapıyoruz
	bucketName = "mock-bucket"
	domainName = "iluvcode.art"
	
	// S3 Client'i Mock objemizle değiştiriyoruz (AWS KEY GEREKMEZ)
	s3Client = &mockS3Client{}

	// Test Senaryosu 1: Başarılı Subdomain İsteği
	req := events.LambdaFunctionURLRequest{
		RawPath: "/index.html",
		Headers: map[string]string{
			"host": "ahmet.iluvcode.art",
		},
	}

	resp, err := handler(context.Background(), req)
	if err != nil {
		t.Fatalf("Handler hata döndürdü: %v", err)
	}

	if resp.StatusCode != 200 {
		t.Errorf("Beklenen HTTP 200, alınan: %d", resp.StatusCode)
	}
	
	expectedBody := "<html><body>Merhaba Ahmet!</body></html>"
	if resp.Body != expectedBody {
		t.Errorf("Beklenen Body: %s, alınan: %s", expectedBody, resp.Body)
	}

	t.Log("Senaryo 1 (ahmet.iluvcode.art) Başarılı. Yanıt:", resp.Body)

	// Test Senaryosu 2: Olmayan Subdomain İsteği (404 Fallback test)
	req2 := events.LambdaFunctionURLRequest{
		RawPath: "/index.html",
		Headers: map[string]string{
			"host": "olmayan.iluvcode.art",
		},
	}

	resp2, err := handler(context.Background(), req2)
	if err != nil {
		t.Fatalf("Handler hata döndürdü: %v", err)
	}

	if resp2.StatusCode != 404 {
		t.Errorf("Beklenen HTTP 404, alınan: %d", resp2.StatusCode)
	}
	
	t.Log("Senaryo 2 (olmayan.iluvcode.art) Başarılı. Yanıt Kodu 404 Döndü.")
}
