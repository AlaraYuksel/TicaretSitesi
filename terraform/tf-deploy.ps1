# ═══════════════════════════════════════════════════════════════════════════════
# Terraform Deploy Sarmalayıcı — terraform/.env → terraform değişkenleri
# ═══════════════════════════════════════════════════════════════════════════════
#
# Terraform .env dosyalarını otomatik OKUMAZ. Bu script:
#   1. terraform/.env'i okur
#   2. AWS kimlik bilgilerini ortama yükler (provider için)
#   3. .env değerlerinden terraform.auto.tfvars.json üretir (tüm tf değişkenleri)
#   4. terraform'u verilen argümanlarla çalıştırır
#
# Kullanım (terraform/ dizininden):
#   .\tf-deploy.ps1 init
#   .\tf-deploy.ps1 plan
#   .\tf-deploy.ps1 apply
#   .\tf-deploy.ps1 destroy
# ═══════════════════════════════════════════════════════════════════════════════
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$TfArgs
)
$ErrorActionPreference = "Stop"

$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "HATA: terraform/.env bulunamadı." -ForegroundColor Red
    exit 1
}

# ── .env oku ─────────────────────────────────────────────────────────────────
$cfg = @{}
foreach ($line in Get-Content $envFile) {
    $t = $line.Trim()
    if ($t -eq "" -or $t.StartsWith("#")) { continue }
    $i = $t.IndexOf("=")
    if ($i -lt 1) { continue }
    $cfg[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim()
}

function Val($key, $default = "") {
    if ($cfg.ContainsKey($key) -and $cfg[$key]) { return $cfg[$key] }
    return $default
}

# ── AWS kimlik bilgileri (provider için) ─────────────────────────────────────
$env:AWS_ACCESS_KEY_ID     = Val "AWS_ACCESS_KEY_ID"
$env:AWS_SECRET_ACCESS_KEY = Val "AWS_SECRET_ACCESS_KEY"
$env:AWS_DEFAULT_REGION    = Val "AWS_REGION" "eu-central-1"

# ── Zorunlu değerler kontrolü ────────────────────────────────────────────────
$required = @{
    "AWS_ACCESS_KEY_ID"     = "AWS erişim anahtarı"
    "AWS_SECRET_ACCESS_KEY" = "AWS gizli anahtarı"
    "DOMAIN_NAME"           = "Domain (iluvcode.art)"
    "CLOUDFLARE_ACCOUNT_ID" = "Cloudflare Account ID"
    "CLOUDFLARE_API_TOKEN"  = "Cloudflare API Token (Zone:Edit + DNS:Edit)"
    "DB_PASSWORD"           = "RDS veritabanı şifresi"
    "JWT_SECRET"            = "JWT imzalama anahtarı (min 32 karakter)"
    "GEMINI_API_KEY"        = "Google Gemini API anahtarı"
}
$missing = @()
foreach ($k in $required.Keys) {
    if (-not (Val $k)) { $missing += "  - $k  ($($required[$k]))" }
}
if ($missing.Count -gt 0) {
    Write-Host "HATA: terraform/.env içinde eksik zorunlu değerler:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    exit 1
}

# ── terraform.auto.tfvars.json üret (JSON → kaçış sorunsuz) ───────────────────
$vars = [ordered]@{
    project_name             = Val "PROJECT_NAME" "marketplace"
    environment              = Val "ENVIRONMENT" "dev"
    aws_region               = Val "AWS_REGION" "eu-central-1"
    domain_name              = Val "DOMAIN_NAME"
    enable_edge              = $true
    cloudflare_account_id    = Val "CLOUDFLARE_ACCOUNT_ID"
    cloudflare_api_token     = Val "CLOUDFLARE_API_TOKEN"
    db_username              = Val "DB_USERNAME" "platform_admin"
    db_password              = Val "DB_PASSWORD"
    db_name                  = Val "DB_NAME" "platform_prod"
    db_instance_class        = Val "DB_INSTANCE_CLASS" "db.t4g.micro"
    stripe_secret_key        = Val "STRIPE_SECRET_KEY"
    stripe_webhook_secret    = Val "STRIPE_WEBHOOK_SECRET"
    stripe_connect_client_id = Val "STRIPE_CONNECT_CLIENT_ID"
    easypost_api_key         = Val "EASYPOST_API_KEY"
    easypost_webhook_secret  = Val "EASYPOST_WEBHOOK_SECRET"
    gemini_api_key           = Val "GEMINI_API_KEY"
    gemini_model             = Val "GEMINI_MODEL" "gemini-2.5-pro"
    jwt_secret               = Val "JWT_SECRET"
    ses_sender_email         = Val "SES_SENDER_EMAIL"
}
$autoVars = Join-Path $PSScriptRoot "terraform.auto.tfvars.json"
$json = $vars | ConvertTo-Json -Depth 5
# BOM'suz UTF-8 yaz — terraform JSON parser'ı BOM'u reddeder.
[System.IO.File]::WriteAllText($autoVars, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "terraform.auto.tfvars.json üretildi (terraform/.env'den)" -ForegroundColor Green

# ── terraform çalıştır ───────────────────────────────────────────────────────
if (-not $TfArgs -or $TfArgs.Count -eq 0) {
    Write-Host "Kullanım: .\tf-deploy.ps1 <init|plan|apply|destroy>" -ForegroundColor Yellow
    exit 0
}
Write-Host "terraform $($TfArgs -join ' ') çalıştırılıyor..." -ForegroundColor Cyan
terraform @TfArgs
