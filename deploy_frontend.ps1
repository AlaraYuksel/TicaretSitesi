# ═══════════════════════════════════════════════════════════════════════════════
# Frontend Deploy — React/Vite build + S3 react bucket'a yükleme
# ═══════════════════════════════════════════════════════════════════════════════
#
# Önkoşul: terraform apply tamamlanmış olmalı (S3 react bucket oluşmuş).
# AWS CLI kurulu ve kimlik bilgileri tanımlı olmalı.
#
# Kullanım (proje kökünden):
#   .\deploy_frontend.ps1
# ═══════════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = "Stop"

$Root      = $PSScriptRoot
$Frontend  = Join-Path $Root "frontend"
$Terraform = Join-Path $Root "terraform"

# ── 1. Terraform çıktılarından gerekli değerleri oku ─────────────────────────
Write-Host "Terraform çıktıları okunuyor..." -ForegroundColor Cyan
Push-Location $Terraform
$reactBucket = (terraform output -raw s3_react_bucket).Trim()
$domain      = (terraform output -raw cloudflare_zone_id 2>$null)  # zone var mı kontrolü
Pop-Location

if (-not $reactBucket) {
    Write-Host "HATA: s3_react_bucket çıktısı boş — önce terraform apply çalıştırın." -ForegroundColor Red
    exit 1
}
Write-Host "  React bucket: $reactBucket" -ForegroundColor Green

# ── 2. AI Function URL subdomain'lerini .env.production'a yaz ─────────────────
# AI endpoint'leri ai-builder/ai-solver subdomain'lerinden servis edilir.
$domainName = "iluvcode.art"
$envProd = Join-Path $Frontend ".env.production"
$envContent = "VITE_AI_BUILDER_URL=https://ai-builder.$domainName`nVITE_AI_SOLVER_URL=https://ai-solver.$domainName`n"
# BOM'suz UTF-8 — Vite .env dosyalarında BOM ilk değişken adını bozar.
[System.IO.File]::WriteAllText($envProd, $envContent, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "  .env.production yazıldı (AI subdomain'leri)" -ForegroundColor Green

# ── 3. Frontend build ────────────────────────────────────────────────────────
Write-Host "Frontend derleniyor (npm run build)..." -ForegroundColor Cyan
Push-Location $Frontend
npm ci
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "npm ci başarısız" -ForegroundColor Red; exit 1 }
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "build başarısız" -ForegroundColor Red; exit 1 }
Pop-Location

$dist = Join-Path $Frontend "dist"
if (-not (Test-Path $dist)) {
    Write-Host "HATA: dist/ oluşmadı" -ForegroundColor Red
    exit 1
}

# ── 4. S3'e yükle ────────────────────────────────────────────────────────────
Write-Host "S3'e yükleniyor: s3://$reactBucket/ ..." -ForegroundColor Cyan
aws s3 sync $dist "s3://$reactBucket/" --delete
if ($LASTEXITCODE -ne 0) { Write-Host "s3 sync başarısız" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "Frontend deploy tamamlandı → https://$domainName" -ForegroundColor Green
Write-Host "Not: static-serve Lambda index.html'i 60sn cache'ler; değişiklik kısa sürede yansır." -ForegroundColor Yellow
