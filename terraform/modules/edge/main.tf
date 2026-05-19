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

# Wildcard API Gateway custom domain hedefi (*.iluvcode.art → domain-router)
variable "wildcard_api_domain_target" { type = string }

# ACM sertifika doğrulama bilgileri
variable "acm_cert_validation_records" {
  type = list(object({
    name   = string
    record = string
    type   = string
  }))
  default = []
}

# AI artık ana API Gateway üzerinden (asenkron iş kuyruğu) — ayrı subdomain yok.

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

# Wildcard → Wildcard API Gateway (Published Sites)
# ahmet.iluvcode.art → Wildcard API Gateway → domain-router Lambda
resource "cloudflare_record" "wildcard_sites" {
  zone_id = var.cloudflare_zone_id
  name    = "*"
  content = var.wildcard_api_domain_target
  type    = "CNAME"
  proxied = true # Cloudflare CDN + Universal SSL
  comment = "Published Sites - Wildcard API Gateway"
}

# ═══════════════════════════════════════════════════════════════════════════════
# ACM Sertifika DNS Doğrulama (Cloudflare üzerinden)
# ═══════════════════════════════════════════════════════════════════════════════

# count kullanılır (for_each değil): doğrulama kaydı NAME'leri apply-zamanı
# bilindiği için for_each anahtar olarak kullanamaz; ama kayıt SAYISI (domain
# + SAN = 2) plan-zamanı bellidir.
resource "cloudflare_record" "acm_validation" {
  count = length(var.acm_cert_validation_records)

  zone_id = var.cloudflare_zone_id
  name    = var.acm_cert_validation_records[count.index].name
  content = var.acm_cert_validation_records[count.index].record
  type    = var.acm_cert_validation_records[count.index].type
  proxied = false # Doğrulama kayıtları proxy'lenmemeli
  comment = "ACM SSL Doğrulama"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Cloudflare Cache Rules — YORUM SATIRINDA
# ═══════════════════════════════════════════════════════════════════════════════
# Cache Rules ruleset'i için kullanılan API token "request is not authorized"
# döndürdü — token'da Cache Rules izni yok. Opsiyonel bir performans
# optimizasyonu olduğu (güvenlik değil) ve zone ayarlarında browser_cache_ttl
# zaten tanımlı olduğu için yorum satırına alındı. Token'a "Cache Rules:Edit"
# izni eklenirse geri açılabilir.
#
# resource "cloudflare_ruleset" "cache_rules" {
#   zone_id     = var.cloudflare_zone_id
#   name        = "Cache Rules"
#   description = "Statik dosya cache kurallari"
#   kind        = "zone"
#   phase       = "http_request_cache_settings"
#
#   rules {
#     action = "set_cache_settings"
#     action_parameters {
#       cache = true
#       browser_ttl { mode = "override_origin", default = 604800 }
#       edge_ttl    { mode = "override_origin", default = 604800 }
#     }
#     expression  = "(http.request.uri.path matches \"\\.(js|css|woff2|woff|ttf|ico|svg)$\")"
#     description = "Cache static assets"
#     enabled     = true
#   }
#   rules {
#     action = "set_cache_settings"
#     action_parameters {
#       cache = true
#       browser_ttl { mode = "override_origin", default = 2592000 }
#       edge_ttl    { mode = "override_origin", default = 2592000 }
#     }
#     expression  = "(http.request.uri.path matches \"\\.(jpg|jpeg|png|gif|webp|avif)$\")"
#     description = "Cache images"
#     enabled     = true
#   }
# }

# ═══════════════════════════════════════════════════════════════════════════════
# GÜVENLİK — Cloudflare Free Plan
# ═══════════════════════════════════════════════════════════════════════════════
#
# DDoS koruması: L3/L4/L7 otomatik, her zaman açık, ücretsiz — DNS kayıtları
# proxied=true olduğu için terraform/yapılandırma gerektirmez.
#
# Bot Fight Mode: Free plan'de mevcut; terraform provider desteği kısıtlı
# olduğundan deploy sonrası Cloudflare Dashboard → Security → Bots'tan açılmalı.

# ── Custom WAF Kuralları (Free plan: 5 kurala kadar) ─────────────────────────
resource "cloudflare_ruleset" "waf_custom" {
  zone_id     = var.cloudflare_zone_id
  name        = "Custom WAF Rules"
  description = "Temel uygulama katmanı güvenlik kuralları"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  # /api/* isteklerini WAF managed kurallarından MUAF tut.
  # Editör, site içeriğini (HTML/script benzeri metinler içeren) JSON gövdeyle
  # gönderir; managed WAF bunu saldırı sanıp 403 verebiliyordu. Bu skip kuralı
  # EN ÜSTTE olmalı — eşleşen istek kalan kuralları ve managed fazı atlar.
  rules {
    action = "skip"
    action_parameters {
      ruleset = "current"
      phases  = ["http_request_firewall_managed"]
    }
    # skip kuralları için Cloudflare provider'ı logging bloğu bekler
    # (yoksa "inconsistent result after apply" hatası verir).
    logging {
      enabled = true
    }
    expression  = "(starts_with(http.request.uri.path, \"/api/\"))"
    description = "API isteklerini WAF'tan muaf tut"
    enabled     = true
  }

  # Bilinen kötü/otomasyon user-agent'larını ve boş UA'ları zorla (challenge)
  rules {
    action      = "managed_challenge"
    expression  = "(http.user_agent eq \"\") or (http.user_agent contains \"sqlmap\") or (http.user_agent contains \"nikto\") or (http.user_agent contains \"nmap\")"
    description = "Supheli/otomasyon user-agent challenge"
    enabled     = true
  }

  # Yaygın saldırı path'lerini blokla (WordPress vb. probe'lar)
  rules {
    action      = "block"
    expression  = "(http.request.uri.path contains \"/wp-admin\") or (http.request.uri.path contains \"/wp-login\") or (http.request.uri.path contains \"/.env\") or (http.request.uri.path contains \"/.git\")"
    description = "Yaygin acik tarama path'lerini blokla"
    enabled     = true
  }
}

# ── Rate Limiting (Free plan: 1 kural) ───────────────────────────────────────
# Login/register endpoint'lerinde brute-force koruması.
resource "cloudflare_ruleset" "rate_limit" {
  zone_id     = var.cloudflare_zone_id
  name        = "Rate Limiting"
  description = "Auth endpoint'leri icin IP basina istek limiti"
  kind        = "zone"
  phase       = "http_ratelimit"

  rules {
    action      = "block"
    description = "Auth brute-force korumasi"
    expression  = "(http.request.uri.path contains \"/api/auth/\")"
    enabled     = true

    ratelimit {
      # Cloudflare Free plan: period yalnızca 10 saniye olabilir.
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 10
      requests_per_period = 20
      mitigation_timeout  = 10
    }
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# OUTPUTS
# Not: cloudflare_zone_id ve nameservers artık kök modülde (cycle önlemi)
# ═══════════════════════════════════════════════════════════════════════════════
