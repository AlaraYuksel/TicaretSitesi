# ═══════════════════════════════════════════════════════════════════════════════
# EDGE MODÜLÜ — CloudFront CDN, WAF, ACM SSL, Route 53
# Mimari Diyagram: "Edge Katmanı" + "Domain & Sertifika"
# ═══════════════════════════════════════════════════════════════════════════════

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

variable "name_prefix"                 { type = string }
variable "domain_name"                 { type = string }
variable "route53_zone_id"             { type = string }
variable "s3_react_bucket_domain"      { type = string }
variable "s3_react_bucket_arn"         { type = string }
variable "s3_assets_bucket_domain"     { type = string }
variable "s3_published_bucket_domain"  { type = string }
variable "s3_published_bucket_arn"     { type = string }
variable "api_gateway_invoke_url"      { type = string }

# ═══════════════════════════════════════════════════════════════════════════════
# ACM — SSL Sertifikaları (us-east-1 zorunlu — CloudFront gereksinimi)
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_acm_certificate" "main" {
  provider          = aws.us_east_1
  domain_name       = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method = "DNS"

  lifecycle { create_before_destroy = true }
  tags = { Name = "${var.name_prefix}-ssl" }
}

# DNS doğrulama — Route 53 zone varsa otomatik
resource "aws_route53_record" "cert_validation" {
  for_each = var.route53_zone_id != "" ? {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  zone_id = var.route53_zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60

  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "main" {
  count    = var.route53_zone_id != "" ? 1 : 0
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# ═══════════════════════════════════════════════════════════════════════════════
# CloudFront — Platform CDN (React + API + Assets)
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_cloudfront_origin_access_identity" "react" {
  comment = "${var.name_prefix} React S3 OAI"
}

resource "aws_cloudfront_distribution" "platform" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${var.name_prefix} Platform CDN"
  price_class         = "PriceClass_100"  # NA + EU (Frankfurt dahil)
  aliases             = var.route53_zone_id != "" ? [var.domain_name, "www.${var.domain_name}"] : []

  # ── Origin 1: S3 React Build ────────────────────────────────────────────
  origin {
    domain_name = var.s3_react_bucket_domain
    origin_id   = "s3-react"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.react.cloudfront_access_identity_path
    }
  }

  # ── Origin 2: API Gateway ──────────────────────────────────────────────
  origin {
    domain_name = replace(var.api_gateway_invoke_url, "https://", "")
    origin_id   = "api-gateway"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # ── Origin 3: S3 Assets ────────────────────────────────────────────────
  origin {
    domain_name = var.s3_assets_bucket_domain
    origin_id   = "s3-assets"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.react.cloudfront_access_identity_path
    }
  }

  # ── Default: React SPA ─────────────────────────────────────────────────
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-react"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  # ── /api/* → API Gateway ───────────────────────────────────────────────
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "api-gateway"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "Origin"]
      cookies { forward = "all" }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # ── /assets/* → S3 User Assets ────────────────────────────────────────
  ordered_cache_behavior {
    path_pattern           = "/assets/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-assets"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 86400
    default_ttl = 604800   # 7 gün
    max_ttl     = 2592000  # 30 gün
  }

  # SPA: 404 → index.html
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  viewer_certificate {
    acm_certificate_arn      = var.route53_zone_id != "" ? aws_acm_certificate.main.arn : null
    cloudfront_default_certificate = var.route53_zone_id == ""
    ssl_support_method       = var.route53_zone_id != "" ? "sni-only" : null
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  tags = { Name = "${var.name_prefix}-platform-cdn" }
}

# ═══════════════════════════════════════════════════════════════════════════════
# CloudFront — Published Sites CDN (satıcı siteleri)
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_cloudfront_origin_access_identity" "published" {
  comment = "${var.name_prefix} Published Sites OAI"
}

resource "aws_cloudfront_distribution" "published" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${var.name_prefix} Published Sites CDN"
  price_class     = "PriceClass_100"
  aliases         = var.route53_zone_id != "" ? ["*.${var.domain_name}"] : []

  origin {
    domain_name = var.s3_published_bucket_domain
    origin_id   = "s3-published"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.published.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-published"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      headers      = ["Host"]
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  viewer_certificate {
    acm_certificate_arn      = var.route53_zone_id != "" ? aws_acm_certificate.main.arn : null
    cloudfront_default_certificate = var.route53_zone_id == ""
    ssl_support_method       = var.route53_zone_id != "" ? "sni-only" : null
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  tags = { Name = "${var.name_prefix}-published-cdn" }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Route 53 DNS Kayıtları
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_route53_record" "platform" {
  count   = var.route53_zone_id != "" ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.platform.domain_name
    zone_id                = aws_cloudfront_distribution.platform.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "platform_www" {
  count   = var.route53_zone_id != "" ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.platform.domain_name
    zone_id                = aws_cloudfront_distribution.platform.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "wildcard" {
  count   = var.route53_zone_id != "" ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "*.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.published.domain_name
    zone_id                = aws_cloudfront_distribution.published.hosted_zone_id
    evaluate_target_health = false
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# OUTPUTS
# ═══════════════════════════════════════════════════════════════════════════════

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.platform.domain_name
}

output "cloudfront_published_domain" {
  value = aws_cloudfront_distribution.published.domain_name
}

output "acm_certificate_arn" {
  value = aws_acm_certificate.main.arn
}
