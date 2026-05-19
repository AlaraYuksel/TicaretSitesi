# ═══════════════════════════════════════════════════════════════════════════════
# WILDCARD API GATEWAY — *.iluvcode.art → domain-router (yayınlanan siteler)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Ana API Gateway iluvcode.art içindir. Yayınlanan siteler ise alt-domain'lerden
# (ahmet.iluvcode.art) servis edilir. API Gateway host'a göre yönlendiremediği
# için ayrı bir API Gateway + wildcard custom domain kullanılır:
#   *.iluvcode.art → bu API → $default route → domain-router Lambda
# domain-router Host header'ından subdomain'i çıkarır.

resource "aws_apigatewayv2_api" "wildcard" {
  name          = "${var.name_prefix}-wildcard-api"
  protocol_type = "HTTP"
  description   = "Published sites router (*.${var.domain_name})"
}

resource "aws_apigatewayv2_stage" "wildcard" {
  api_id      = aws_apigatewayv2_api.wildcard.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "wildcard_router" {
  api_id                 = aws_apigatewayv2_api.wildcard.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.domain_router.invoke_arn
  payload_format_version = "2.0"
}

# $default — *.iluvcode.art'a gelen tüm istekler domain-router'a
resource "aws_apigatewayv2_route" "wildcard_default" {
  api_id    = aws_apigatewayv2_api.wildcard.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.wildcard_router.id}"
}

resource "aws_lambda_permission" "apigw_domain_router" {
  statement_id  = "AllowWildcardAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.domain_router.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.wildcard.execution_arn}/*/*"
}

# ── Wildcard Custom Domain (*.iluvcode.art) ──────────────────────────────────
resource "aws_apigatewayv2_domain_name" "wildcard" {
  count       = var.domain_name != "" ? 1 : 0
  domain_name = "*.${var.domain_name}"

  domain_name_configuration {
    certificate_arn = aws_acm_certificate.wildcard[0].arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = { Name = "${var.name_prefix}-wildcard-domain" }
}

resource "aws_apigatewayv2_api_mapping" "wildcard" {
  count       = var.domain_name != "" ? 1 : 0
  api_id      = aws_apigatewayv2_api.wildcard.id
  domain_name = aws_apigatewayv2_domain_name.wildcard[0].id
  stage       = aws_apigatewayv2_stage.wildcard.id
}

# Cloudflare wildcard CNAME hedefi
output "wildcard_api_domain_target" {
  value = var.domain_name != "" ? aws_apigatewayv2_domain_name.wildcard[0].domain_name_configuration[0].target_domain_name : ""
}
