# ═══════════════════════════════════════════════════════════════════════════════
# COMPUTE — API Gateway (HTTP API) + Route'lar
# Route'lar gerçek backend (main.go) endpoint'leriyle birebir eşleşir.
# AI endpoint'leri burada YOK — onlar Lambda Function URL kullanır (ai modülü).
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_apigatewayv2_api" "main" {
  name          = "${var.name_prefix}-api"
  protocol_type = "HTTP"
  description   = "Marketplace Platform API"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 3600
  }
}

resource "aws_cloudwatch_log_group" "api_gw" {
  name              = "/aws/apigateway/${var.name_prefix}-api"
  retention_in_days = 3 # test ortamı — maliyet için kısa tutuldu
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw.arn
    format = jsonencode({
      requestId = "$context.requestId"
      ip        = "$context.identity.sourceIp"
      method    = "$context.httpMethod"
      route     = "$context.routeKey"
      status    = "$context.status"
    })
  }
}

# ── Lambda → integration / route / permission eşlemeleri ─────────────────────
locals {
  # API Gateway'e bağlı Lambda'lar (invoke_arn ve function_name)
  api_lambda_arn = {
    auth     = aws_lambda_function.auth.invoke_arn
    sites    = aws_lambda_function.sites.invoke_arn
    products = aws_lambda_function.products.invoke_arn
    orders   = aws_lambda_function.orders.invoke_arn
    seller   = aws_lambda_function.seller.invoke_arn
    buyer    = aws_lambda_function.buyer.invoke_arn
    webhooks = aws_lambda_function.webhooks.invoke_arn
  }
  api_lambda_name = {
    auth     = aws_lambda_function.auth.function_name
    sites    = aws_lambda_function.sites.function_name
    products = aws_lambda_function.products.function_name
    orders   = aws_lambda_function.orders.function_name
    seller   = aws_lambda_function.seller.function_name
    buyer    = aws_lambda_function.buyer.function_name
    webhooks = aws_lambda_function.webhooks.function_name
  }

  # route_key → hangi Lambda. Kaynak: backend/main.go
  routes = {
    # Auth
    "POST /api/auth/register" = "auth"
    "POST /api/auth/login"    = "auth"
    "GET /api/auth/me"        = "auth"

    # Sites (editör)
    "GET /api/sites"                 = "sites"
    "POST /api/sites"                = "sites"
    "GET /api/sites/{id}"            = "sites"
    "PUT /api/sites/{id}/data"       = "sites"
    "POST /api/sites/{id}/publish"   = "sites"
    "POST /api/sites/{id}/unpublish" = "sites"
    "DELETE /api/sites/{id}"         = "sites"

    # Products + Marketplace ürün listeleme + Q&A
    "GET /api/products"                             = "products"
    "GET /api/products/{id}"                        = "products"
    "POST /api/products"                            = "products"
    "PUT /api/products/{id}"                        = "products"
    "DELETE /api/products/{id}"                     = "products"
    "GET /api/marketplace/products"                 = "products"
    "GET /api/marketplace/products/{id}"            = "products"
    "GET /api/marketplace/categories"               = "products"
    "GET /api/marketplace/products/{id}/questions"  = "products"
    "POST /api/marketplace/products/{id}/questions" = "products"

    # Orders + Marketplace orders + Buyer orders + Storefront
    "GET /api/orders"                                   = "orders"
    "POST /api/orders"                                  = "orders"
    "GET /api/orders/{id}"                              = "orders"
    "POST /api/marketplace/orders"                      = "orders"
    "GET /api/marketplace/orders/{orderNumber}"         = "orders"
    "POST /api/marketplace/orders/{id}/confirm-payment" = "orders"
    "GET /api/buyer/orders"                             = "orders"
    "POST /api/buyer/orders/{id}/cancel"                = "orders"
    "POST /api/storefront/orders"                       = "orders"
    "POST /api/storefront/orders/track"                 = "orders"
    "POST /api/storefront/orders/verify"                = "orders"
    "GET /api/storefront/orders/detail/{orderNumber}"   = "orders"
    "GET /api/storefront/sites/{siteId}/products"       = "orders"

    # Seller paneli
    "GET /api/seller/dashboard"                                = "seller"
    "POST /api/seller/register"                                = "seller"
    "POST /api/seller/connect"                                 = "seller"
    "POST /api/seller/shipments"                               = "seller"
    "GET /api/seller/questions"                                = "seller"
    "POST /api/seller/questions/{id}/answer"                   = "seller"
    "GET /api/seller/marketplace-orders"                       = "seller"
    "GET /api/seller/marketplace-orders/{id}"                  = "seller"
    "POST /api/seller/marketplace-orders/{id}/approve"         = "seller"
    "POST /api/seller/marketplace-orders/{id}/reject"          = "seller"
    "POST /api/seller/marketplace-orders/{id}/cancel"          = "seller"
    "POST /api/seller/marketplace-orders/{id}/ship"            = "seller"
    "POST /api/seller/marketplace-orders/{id}/mark-delivered"  = "seller"
    "POST /api/seller/marketplace-orders/{id}/release-escrow"  = "seller"
    "GET /api/seller/balance"                                  = "seller"

    # Buyer profil / adres / ödeme yöntemleri
    "PUT /api/buyer/profile"                          = "buyer"
    "GET /api/buyer/addresses"                        = "buyer"
    "POST /api/buyer/addresses"                       = "buyer"
    "PUT /api/buyer/addresses/{id}"                   = "buyer"
    "DELETE /api/buyer/addresses/{id}"                = "buyer"
    "PUT /api/buyer/addresses/{id}/default"           = "buyer"
    "POST /api/buyer/payment-methods/setup-intent"    = "buyer"
    "GET /api/buyer/payment-methods"                  = "buyer"
    "POST /api/buyer/payment-methods"                 = "buyer"
    "DELETE /api/buyer/payment-methods/{id}"          = "buyer"
    "PUT /api/buyer/payment-methods/{id}/default"     = "buyer"

    # Webhooks
    "POST /api/webhooks/stripe"   = "webhooks"
    "POST /api/webhooks/easypost" = "webhooks"
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  for_each               = local.api_lambda_arn
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "api" {
  for_each  = local.routes
  api_id    = aws_apigatewayv2_api.main.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.lambda[each.value].id}"
}

resource "aws_lambda_permission" "apigw" {
  for_each      = local.api_lambda_name
  statement_id  = "AllowAPIGatewayInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ═══════════════════════════════════════════════════════════════════════════════
# OUTPUTS
# ═══════════════════════════════════════════════════════════════════════════════
output "lambda_security_group_id" { value = aws_security_group.lambda.id }
output "api_gateway_id"            { value = aws_apigatewayv2_api.main.id }
output "api_gateway_execution_arn" { value = aws_apigatewayv2_api.main.execution_arn }
output "api_gateway_invoke_url"    { value = aws_apigatewayv2_stage.default.invoke_url }

# Domain Router Lambda Function URL
output "domain_router_function_url" {
  value = aws_lambda_function_url.domain_router.function_url
}

# Domain Router URL domain (Cloudflare CNAME için)
output "domain_router_url_domain" {
  value = replace(replace(aws_lambda_function_url.domain_router.function_url, "https://", ""), "/", "")
}

# API Gateway Custom Domain hedefi
output "api_gw_custom_domain_target" {
  value = length(aws_apigatewayv2_domain_name.platform) > 0 ? aws_apigatewayv2_domain_name.platform[0].domain_name_configuration[0].target_domain_name : ""
}

# ACM doğrulama kayıtları (Cloudflare'e eklenecek)
output "acm_cert_validation_records" {
  value = var.domain_name != "" ? [for dvo in aws_acm_certificate.platform[0].domain_validation_options : {
    name   = dvo.resource_record_name
    record = dvo.resource_record_value
    type   = dvo.resource_record_type
  }] : []
}

# ═══════════════════════════════════════════════════════════════════════════════
# ACM Sertifika (eu-central-1 — CloudFront gerektirmediği için us-east-1 GEREKMEZ)
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_acm_certificate" "platform" {
  count                     = var.domain_name != "" ? 1 : 0
  domain_name               = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle { create_before_destroy = true }
  tags = { Name = "${var.name_prefix}-platform-ssl" }
}

# ═══════════════════════════════════════════════════════════════════════════════
# API Gateway Custom Domain (iluvcode.art → API Gateway)
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_apigatewayv2_domain_name" "platform" {
  count       = var.domain_name != "" ? 1 : 0
  domain_name = var.domain_name

  domain_name_configuration {
    certificate_arn = aws_acm_certificate.platform[0].arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = { Name = "${var.name_prefix}-apigw-domain" }
}

resource "aws_apigatewayv2_api_mapping" "platform" {
  count       = var.domain_name != "" ? 1 : 0
  api_id      = aws_apigatewayv2_api.main.id
  domain_name = aws_apigatewayv2_domain_name.platform[0].id
  stage       = aws_apigatewayv2_stage.default.id
}

# ═══════════════════════════════════════════════════════════════════════════════
# Static Serve — SPA catch-all route ($default)
# /api/* dışındaki tüm istekler → S3 React bucket'tan serve
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_apigatewayv2_integration" "static_serve" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.static_serve.invoke_arn
  payload_format_version = "2.0"
}

# $default route: API route'larıyla eşleşmeyen tüm istekleri yakalar
resource "aws_apigatewayv2_route" "spa_fallback" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.static_serve.id}"
}

resource "aws_lambda_permission" "apigw_static_serve" {
  statement_id  = "AllowAPIGatewayInvoke-static-serve"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.static_serve.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
