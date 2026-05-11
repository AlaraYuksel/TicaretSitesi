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
	bucket := *params.Bucket

	// Eğer index.html isteniyorsa
	if key == "index.html" && bucket == "mock-react" {
		htmlContent := "<div id='root'>Mock React App</div>"
		return &s3.GetObjectOutput{
			Body: io.NopCloser(bytes.NewReader([]byte(htmlContent))),
		}, nil
	}

	// Eğer spesifik bir asset isteniyorsa
	if key == "js/main.js" && bucket == "mock-react" {
		jsContent := "console.log('React is running');"
		return &s3.GetObjectOutput{
			Body: io.NopCloser(bytes.NewReader([]byte(jsContent))),
		}, nil
	}

	if key == "assets/logo.png" && bucket == "mock-assets" {
		pngContent := "mock-png-bytes"
		return &s3.GetObjectOutput{
			Body: io.NopCloser(bytes.NewReader([]byte(pngContent))),
		}, nil
	}

	// Diğer durumlar için 404 / NoSuchKey
	return nil, fmt.Errorf("NoSuchKey: The specified key does not exist")
}

func TestStaticServeHandler(t *testing.T) {
	os.Setenv("S3_REACT_BUCKET", "mock-react")
	os.Setenv("S3_ASSETS_BUCKET", "mock-assets")
	
	reactBucket = "mock-react"
	assetsBucket = "mock-assets"
	s3Client = &mockS3Client{}

	// Test 1: Ana Sayfa İsteği (index.html dönmeli)
	req1 := events.APIGatewayV2HTTPRequest{
		RawPath: "/",
	}
	resp1, _ := handler(context.Background(), req1)
	if resp1.StatusCode != 200 {
		t.Errorf("Ana sayfa beklenirken Hata döndü: %d", resp1.StatusCode)
	}
	t.Log("Senaryo 1 (Ana sayfa /) Başarılı. İçerik:", resp1.Body)

	// Test 2: SPA Route İsteği (index.html dönmeli)
	req2 := events.APIGatewayV2HTTPRequest{
		RawPath: "/dashboard",
	}
	resp2, _ := handler(context.Background(), req2)
	if resp2.StatusCode != 200 {
		t.Errorf("SPA Dashboard beklenirken Hata döndü: %d", resp2.StatusCode)
	}
	t.Log("Senaryo 2 (/dashboard) Başarılı. SPA Fallback çalıştı. İçerik:", resp2.Body)

	// Test 3: Statik JS Dosyası (S3'ten çekmeli)
	req3 := events.APIGatewayV2HTTPRequest{
		RawPath: "/js/main.js",
	}
	resp3, _ := handler(context.Background(), req3)
	if resp3.StatusCode != 200 {
		t.Errorf("JS dosyası beklenirken Hata döndü: %d", resp3.StatusCode)
	}
	t.Log("Senaryo 3 (/js/main.js) Başarılı. İçerik:", resp3.Body)

	// Test 4: Assets Dosyası (Logo - Assets bucketından çekmeli)
	req4 := events.APIGatewayV2HTTPRequest{
		RawPath: "/assets/logo.png",
	}
	resp4, _ := handler(context.Background(), req4)
	if resp4.StatusCode != 200 {
		t.Errorf("Logo beklenirken Hata döndü: %d", resp4.StatusCode)
	}
	if !resp4.IsBase64Encoded {
		t.Errorf("Resim base64 encode edilmemiş!")
	}
	t.Log("Senaryo 4 (/assets/logo.png) Başarılı. Base64 Döndü.")
}
