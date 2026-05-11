param(
    [string]$Function = "all"
)

$ErrorActionPreference = "Stop"
$BuildDir = Join-Path (Join-Path $PSScriptRoot "build") "lambda"

$env:GOOS = "linux"
$env:GOARCH = "arm64"
$env:CGO_ENABLED = "0"

function Build-Lambda {
    param([string]$Name)
    
    Write-Host ""
    Write-Host "=== Building: $Name ===" -ForegroundColor Cyan
    
    $outDir = Join-Path $BuildDir $Name
    if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    
    Write-Host "  Compiling..." -ForegroundColor Yellow
    go build -tags lambda.norpc -ldflags="-s -w" -o (Join-Path $outDir "bootstrap") "./cmd/$Name/"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  BUILD FAILED!" -ForegroundColor Red
        return
    }
    
    Write-Host "  Zipping..." -ForegroundColor Yellow
    $zipPath = Join-Path $outDir "$Name.zip"
    Compress-Archive -Path (Join-Path $outDir "bootstrap") -DestinationPath $zipPath -Force
    
    $size = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
    Write-Host "  Done: $Name.zip ($size MB)" -ForegroundColor Green
}

Write-Host "Lambda Build - ARM64 Linux" -ForegroundColor Cyan

if ($Function -eq "all" -or $Function -eq "domain-router") {
    Build-Lambda "domain-router"
}

if ($Function -eq "all" -or $Function -eq "static-serve") {
    Build-Lambda "static-serve"
}

Remove-Item Env:\GOOS
Remove-Item Env:\GOARCH
Remove-Item Env:\CGO_ENABLED

Write-Host ""
Write-Host "Build OK! ZIPs: $BuildDir" -ForegroundColor Green
