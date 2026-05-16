#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Codespaces ortam kurulumu — konteyner ilk oluşturulduğunda bir kez çalışır
# ═══════════════════════════════════════════════════════════════════════════════
set -e

echo "▶ LocalStack CLI ve Terraform/AWS wrapper'ları kuruluyor..."
pip install --quiet --user localstack terraform-local awscli-local

echo "▶ Güvenlik tarama araçları kuruluyor..."
# trivy (eski tfsec) — Terraform güvenlik taraması
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh \
  | sudo sh -s -- -b /usr/local/bin

echo "▶ LocalStack konteyneri indiriliyor..."
docker pull localstack/localstack:latest

echo "▶ Terraform modülleri başlatılıyor..."
cd terraform && terraform init -backend=false && cd ..

echo "✅ Kurulum tamamlandı. Test için: bkz. .devcontainer/README-test.md"
