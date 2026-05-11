# ═══════════════════════════════════════════════════════════════════════════════
# Terraform Değişkenleri — Marketplace + AI (AWS + Cloudflare)
# ═══════════════════════════════════════════════════════════════════════════════

# ─── Genel ────────────────────────────────────────────────────────────────────
variable "aws_region" {
  description = "AWS bölgesi (Türkiye'ye en yakın: Frankfurt)"
  type        = string
  default     = "eu-central-1"
}

variable "project_name" {
  description = "Proje adı — tüm kaynak isimlendirmelerinde prefix olarak kullanılır"
  type        = string
  default     = "marketplace"
}

variable "environment" {
  description = "Ortam: dev / staging / prod"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment 'dev', 'staging' veya 'prod' olmalıdır."
  }
}

variable "tags" {
  description = "Tüm kaynaklara eklenecek ortak etiketler"
  type        = map(string)
  default     = {}
}

# ─── Domain ───────────────────────────────────────────────────────────────────
variable "domain_name" {
  description = "Ana platform domain'i (ör: iluvcode.art)"
  type        = string
}

# ─── Cloudflare (CloudFront yerine) ──────────────────────────────────────────
variable "cloudflare_api_token" {
  description = "Cloudflare API token (Zone:Edit, DNS:Edit izinleri)"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID (Dashboard → Overview → sağ altta)"
  type        = string
}

# ─── RDS PostgreSQL ──────────────────────────────────────────────────────────
variable "db_username" {
  description = "RDS master kullanıcı adı"
  type        = string
  default     = "platform_admin"
}

variable "db_password" {
  description = "RDS master şifresi"
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "Veritabanı adı"
  type        = string
  default     = "platform_prod"
}

variable "db_instance_class" {
  description = "RDS instance tipi"
  type        = string
  default     = "db.t3.micro"
}

# ─── Stripe ──────────────────────────────────────────────────────────────────
variable "stripe_secret_key" {
  description = "Stripe gizli API anahtarı"
  type        = string
  sensitive   = true
}

variable "stripe_webhook_secret" {
  description = "Stripe Webhook doğrulama anahtarı"
  type        = string
  sensitive   = true
}

variable "stripe_connect_client_id" {
  description = "Stripe Connect OAuth client ID"
  type        = string
  default     = ""
}

# ─── EasyPost ────────────────────────────────────────────────────────────────
variable "easypost_api_key" {
  description = "EasyPost API anahtarı"
  type        = string
  sensitive   = true
}

variable "easypost_webhook_secret" {
  description = "EasyPost Webhook HMAC anahtarı"
  type        = string
  sensitive   = true
}

# ─── AI / Claude ─────────────────────────────────────────────────────────────
variable "anthropic_api_key" {
  description = "Anthropic Claude API anahtarı"
  type        = string
  sensitive   = true
}

variable "claude_model" {
  description = "Kullanılacak Claude model ID"
  type        = string
  default     = "claude-sonnet-4-20250514"
}

# ─── JWT / Auth ──────────────────────────────────────────────────────────────
variable "jwt_secret" {
  description = "JWT token imzalama anahtarı (min 32 karakter)"
  type        = string
  sensitive   = true
}

# ─── SES ─────────────────────────────────────────────────────────────────────
variable "ses_sender_email" {
  description = "SES ile gönderilecek e-posta adresi"
  type        = string
  default     = ""
}
