# ═══════════════════════════════════════════════════════════════════════════════
# EDGE MODÜLÜ — Cloudflare DNS + CDN + SSL + WAF (Free Plan)
# CloudFront KALDIRILDI — Cloudflare ile değiştirildi
# ═══════════════════════════════════════════════════════════════════════════════
#
# Mimari:
#   iluvcode.art      → API Gateway Custom Domain (React SPA + API)
#   *.iluvcode.art    → Lambda Function URL (Published Sites)
#   Universal SSL     → *.iluvcode.art otomatik HTTPS ($0)
# ═══════════════════════════════════════════════════════════════════════════════

terraform {
  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
    }
    aws = {
      source = "hashicorp/aws"
    }
  }
}

# ─── Değişkenler ──────────────────────────────────────────────────────────────
variable "name_prefix"            { type = string }
variable "domain_name"            { type = string }

# Cloudflare zone kök modülde oluşturulur (cycle'ı kırmak için) — buraya parametre gelir
variable "cloudflare_zone_id"     { type = string }

# API Gateway custom domain hedefi (xxx.execute-api.eu-central-1.amazonaws.com)
variable "api_gw_custom_domain_target" { type = string }

# Lambda Function URL domain (xxx.lambda-url.eu-central-1.on.aws)
variable "domain_router_url_domain" { type = string }

# ACM sertifika doğrulama bilgileri
variable "acm_cert_validation_records" {
  type = list(object({
    name   = string
    record = string
    type   = string
  }))
  default = []
}

# ═══════════════════════════════════════════════════════════════════════════════
# DNS Kayıtları  (Zone + SSL ayarları kök modüle taşındı — cycle önlemi)
# ═══════════════════════════════════════════════════════════════════════════════

# Platform ana domain → API Gateway Custom Domain
# iluvcode.art → API GW (hem /api/* hem SPA serve eder)
resource "cloudflare_record" "platform" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  content = var.api_gw_custom_domain_target
  type    = "CNAME"
  proxied = true  # Cloudflare CDN + SSL aktif
  comment = "Platform - API Gateway Custom Domain"
}

resource "cloudflare_record" "platform_www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  content = var.api_gw_custom_domain_target
  type    = "CNAME"
  proxied = true
  comment = "Platform WWW"
}

# Wildcard → Lambda Function URL (Published Sites)
# ahmet.iluvcode.art → Domain Router Lambda
resource "cloudflare_record" "wildcard_sites" {
  zone_id = var.cloudflare_zone_id
  name    = "*"
  content = var.domain_router_url_domain
  type    = "CNAME"
  proxied = true  # Cloudflare CDN + Universal SSL
  comment = "Published Sites - Domain Router Lambda"
}

# ═══════════════════════════════════════════════════════════════════════════════
# ACM Sertifika DNS Doğrulama (Cloudflare üzerinden)
# ═══════════════════════════════════════════════════════════════════════════════

resource "cloudflare_record" "acm_validation" {
  for_each = { for r in var.acm_cert_validation_records : r.name => r }

  zone_id = var.cloudflare_zone_id
  name    = each.value.name
  content = each.value.record
  type    = each.value.type
  proxied = false  # Doğrulama kayıtları proxy'lenmemeli
  comment = "ACM SSL Doğrulama"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Cloudflare Cache Rules (Opsiyonel — statik dosyalar için)
# ═══════════════════════════════════════════════════════════════════════════════

resource "cloudflare_ruleset" "cache_rules" {
  zone_id     = cloudflare_zone.main.id
  name        = "Cache Rules"
  description = "Statik dosya cache kuralları"
  kind        = "zone"
  phase       = "http_request_cache_settings"

  # JS/CSS dosyaları: 7 gün cache
  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = true
      browser_ttl {
        mode    = "override_origin"
        default = 604800  # 7 gün
      }
      edge_ttl {
        mode    = "override_origin"
        default = 604800
      }
    }
    expression  = "(http.request.uri.path matches \"\\.(js|css|woff2|woff|ttf|ico|svg)$\")"
    description = "Cache static assets"
    enabled     = true
  }

  # Görseller: 30 gün cache
  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = true
      browser_ttl {
        mode    = "override_origin"
        default = 2592000  # 30 gün
      }
      edge_ttl {
        mode    = "override_origin"
        default = 2592000
      }
    }
    expression  = "(http.request.uri.path matches \"\\.(jpg|jpeg|png|gif|webp|avif)$\")"
    description = "Cache images"
    enabled     = true
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# OUTPUTS
# Not: cloudflare_zone_id ve nameservers artık kök modülde (cycle önlemi)
# ═══════════════════════════════════════════════════════════════════════════════
