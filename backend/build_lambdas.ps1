# ═══════════════════════════════════════════════════════════════════════════════
# Lambda Build — tüm Go Lambda fonksiyonlarını ARM64 Linux için derler ve zip'ler
# ═══════════════════════════════════════════════════════════════════════════════
#
# Kullanım:
#   .\build_lambdas.ps1            # hepsini derle
#   .\build_lambdas.ps1 auth       # sadece auth
#
# Çıktı: backend/build/lambda/<name>/<name>.zip  (terraform bunları kullanır)
# ═══════════════════════════════════════════════════════════════════════════════
param(
    [string]$Function = "all"
)

$ErrorActionPreference = "Stop"
$BuildDir = Join-Path (Join-Path $PSScriptRoot "build") "lambda"

# Terraform'un beklediği tüm Lambda fonksiyonları (cmd/<name> dizinleri)
$Lambdas = @(
    "auth", "sites", "products", "orders", "seller", "buyer", "webhooks",
    "ai-site-builder", "ai-solver",
    "publisher", "finance-worker",
    "migrate",
    "domain-router", "static-serve"
)

$env:GOOS = "linux"
$env:GOARCH = "arm64"
$env:CGO_ENABLED = "0"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# New-LambdaZip — bootstrap'ı zip'ler ve Unix çalıştırma iznini (0755) gömer.
# Compress-Archive bunu yapmaz; provided.al2023 runtime'ı için bootstrap'ın
# çalıştırılabilir olması ŞARTTIR, aksi halde "permission denied" alınır.
function New-LambdaZip {
    param([string]$BootstrapPath, [string]$ZipPath)

    if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
    $zip = [System.IO.Compression.ZipFile]::Open($ZipPath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        $entry = $zip.CreateEntry("bootstrap", [System.IO.Compression.CompressionLevel]::Optimal)
        # Unix mode 0100755 (regular file + rwxr-xr-x) ExternalAttributes'ın
        # üst 16 bitine yazılır. ExternalAttributes Int32 olduğundan bit
        # desenini (uint32) işaretli Int32'ye BitConverter ile çeviriyoruz.
        $unixMode = [Convert]::ToInt32('100755', 8)   # = 33261 (0x81ED)
        $bytes    = [BitConverter]::GetBytes([uint32]($unixMode * 65536))
        $entry.ExternalAttributes = [BitConverter]::ToInt32($bytes, 0)
        $in = [System.IO.File]::OpenRead($BootstrapPath)
        $out = $entry.Open()
        try { $in.CopyTo($out) } finally { $out.Dispose(); $in.Dispose() }
    } finally {
        $zip.Dispose()
    }
}

function Build-Lambda {
    param([string]$Name)

    Write-Host ""
    Write-Host "=== Building: $Name ===" -ForegroundColor Cyan

    $outDir = Join-Path $BuildDir $Name
    if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null

    Write-Host "  Compiling..." -ForegroundColor Yellow
    $bootstrap = Join-Path $outDir "bootstrap"
    go build -tags lambda.norpc -ldflags="-s -w" -o $bootstrap "./cmd/$Name/"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  BUILD FAILED: $Name" -ForegroundColor Red
        exit 1
    }

    Write-Host "  Zipping..." -ForegroundColor Yellow
    $zipPath = Join-Path $outDir "$Name.zip"
    New-LambdaZip -BootstrapPath $bootstrap -ZipPath $zipPath

    $size = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
    Write-Host "  Done: $Name.zip ($size MB)" -ForegroundColor Green
}

Write-Host "Lambda Build - ARM64 Linux" -ForegroundColor Cyan

$built = 0
foreach ($l in $Lambdas) {
    if ($Function -eq "all" -or $Function -eq $l) {
        Build-Lambda $l
        $built++
    }
}

Remove-Item Env:\GOOS
Remove-Item Env:\GOARCH
Remove-Item Env:\CGO_ENABLED

if ($built -eq 0) {
    Write-Host ""
    Write-Host "UYARI: '$Function' eşleşen Lambda yok. Geçerli: $($Lambdas -join ', ')" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Build OK! $built Lambda derlendi. ZIP'ler: $BuildDir" -ForegroundColor Green
