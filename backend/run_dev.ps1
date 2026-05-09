# .env dosyasından değişkenleri al
Get-Content -Path "..\.env" | ForEach-Object {
    if ($_ -match '^(?!#)([^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
    }
}

# Go sunucusunu başlat
Write-Host "Lokal sunucu baslatiliyor..." -ForegroundColor Green
go run .
