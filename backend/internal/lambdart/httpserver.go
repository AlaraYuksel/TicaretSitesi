package lambdart

import (
	"net/http"

	"go-backend-projem/internal/middleware"

	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
	"github.com/aws/aws-lambda-go/lambda"
)

// StartHTTP, bir http.Handler'ı (genelde *http.ServeMux) API Gateway HTTP API
// (payload format 2.0) olaylarına bağlar ve Lambda runtime'ını başlatır.
//
// Verilen handler CORS middleware'i ile sarılır — böylece API Gateway tarafında
// ayrıca CORS yapılandırmasına gerek kalmaz (tek kaynak: uygulama).
func StartHTTP(h http.Handler) {
	wrapped := middleware.CORS(h)
	adapter := httpadapter.NewV2(wrapped)
	lambda.Start(adapter.ProxyWithContext)
}
