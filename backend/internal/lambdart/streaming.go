package lambdart

import (
	"net/http"

	"go-backend-projem/internal/middleware"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-lambda-go/lambdaurl"
)

// StartHTTPStreaming, bir http.Handler'ı Lambda Function URL'e bağlar ve
// response streaming'i etkinleştirir.
//
// AI site builder ve AI solver endpoint'leri SSE (text/event-stream) ile canlı
// ilerleme akışı yapar ve dakikalarca sürebilir. API Gateway HTTP API bunu
// desteklemez (30sn sabit limit + yanıtı buffer'lar). Lambda Function URL +
// RESPONSE_STREAM ile handler'ın Flush çağrıları gerçek zamanlı olarak iletilir.
func StartHTTPStreaming(h http.Handler) {
	lambda.Start(lambdaurl.Wrap(middleware.CORS(h)))
}
