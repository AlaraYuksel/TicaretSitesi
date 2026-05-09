# Script'in bulunduğu dizini al (nereden çağrılırsa çağrılsın doğru çalışır)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

# .env dosyasından değişkenleri al
$envFile = Join-Path $rootDir ".env"
if (Test-Path $envFile) {
    Get-Content -Path $envFile | ForEach-Object {
        if ($_ -match '^(?!#)([^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
    Write-Host ".env dosyasi yuklendi: $envFile" -ForegroundColor DarkGray
} else {
    Write-Host "UYARI: .env dosyasi bulunamadi: $envFile" -ForegroundColor Yellow
}

# Backend dizinine geç ve Go sunucusunu başlat
Write-Host "Lokal sunucu baslatiliyor..." -ForegroundColor Green
Push-Location $scriptDir
try {
    go run .
} finally {
    Pop-Location
}
