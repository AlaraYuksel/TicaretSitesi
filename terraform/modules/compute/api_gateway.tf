# ═══════════════════════════════════════════════════════════════════════════════
# COMPUTE — API Gateway (HTTP API) + Route'lar
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
  retention_in_days = 14
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw.arn
    format = jsonencode({
      requestId  = "$context.requestId"
      ip         = "$context.identity.sourceIp"
      method     = "$context.httpMethod"
      route      = "$context.routeKey"
      status     = "$context.status"
    })
  }
}

# ── Lambda Integrations ──────────────────────────────────────────────────────
resource "aws_apigatewayv2_integration" "auth" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.auth.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "products" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.products.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "orders" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.orders.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "seller" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.seller.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "webhooks" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.webhooks.invoke_arn
  payload_format_version = "2.0"
}

# ── Routes ───────────────────────────────────────────────────────────────────
# Auth
resource "aws_apigatewayv2_route" "auth_register" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/auth/register"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}
resource "aws_apigatewayv2_route" "auth_login" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/auth/login"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}
resource "aws_apigatewayv2_route" "auth_me" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/auth/me"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

# Products
resource "aws_apigatewayv2_route" "products_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/products"
  target    = "integrations/${aws_apigatewayv2_integration.products.id}"
}
resource "aws_apigatewayv2_route" "products_create" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/products"
  target    = "integrations/${aws_apigatewayv2_integration.products.id}"
}
resource "aws_apigatewayv2_route" "products_get" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/products/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.products.id}"
}
resource "aws_apigatewayv2_route" "products_update" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PUT /api/products/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.products.id}"
}
resource "aws_apigatewayv2_route" "products_delete" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /api/products/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.products.id}"
}

# Orders
resource "aws_apigatewayv2_route" "orders_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/orders"
  target    = "integrations/${aws_apigatewayv2_integration.orders.id}"
}
resource "aws_apigatewayv2_route" "orders_create" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/orders"
  target    = "integrations/${aws_apigatewayv2_integration.orders.id}"
}
resource "aws_apigatewayv2_route" "orders_get" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/orders/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.orders.id}"
}

# Seller
resource "aws_apigatewayv2_route" "seller_dashboard" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/seller/dashboard"
  target    = "integrations/${aws_apigatewayv2_integration.seller.id}"
}
resource "aws_apigatewayv2_route" "seller_connect" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/seller/connect"
  target    = "integrations/${aws_apigatewayv2_integration.seller.id}"
}
resource "aws_apigatewayv2_route" "seller_shipments" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/seller/shipments"
  target    = "integrations/${aws_apigatewayv2_integration.seller.id}"
}

# Webhooks
resource "aws_apigatewayv2_route" "webhook_stripe" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/webhooks/stripe"
  target    = "integrations/${aws_apigatewayv2_integration.webhooks.id}"
}
resource "aws_apigatewayv2_route" "webhook_easypost" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/webhooks/easypost"
  target    = "integrations/${aws_apigatewayv2_integration.webhooks.id}"
}

# ── Lambda Permissions ───────────────────────────────────────────────────────
resource "aws_lambda_permission" "apigw_auth" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
resource "aws_lambda_permission" "apigw_products" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.products.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
resource "aws_lambda_permission" "apigw_orders" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.orders.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
resource "aws_lambda_permission" "apigw_seller" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.seller.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
resource "aws_lambda_permission" "apigw_webhooks" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.webhooks.function_name
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
