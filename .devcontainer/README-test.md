# Terraform Mimarisini Test Etme — Codespaces + LocalStack

Bu rehber, mimariyi **gerçek AWS'e hiçbir şey göndermeden** Codespaces içinde test etmek içindir.
Her şey Codespaces konteynerinde çalışır — bilgisayarınız izole kalır.

---

## 0. Codespace'i aç

GitHub'da `AlaraYuksel/TicaretSitesi` reposunda: **Code ▸ Codespaces ▸ Create codespace on main**.
İlk açılışta `setup.sh` otomatik çalışır (Terraform, LocalStack, trivy, tflocal kurulur — birkaç dakika).

---

## Test Katmanı 1 — Sözdizimi & yapı (saniyeler, AWS gerekmez)

```bash
cd terraform
terraform fmt -check -recursive   # format kontrolü
terraform validate                # sözdizimi + modül referansları + tip hataları
tflint --recursive                # best-practice linter
```

`validate` modüller arası bağlantıları (`module.compute.lambda_security_group_id` vb.)
ve değişken tiplerini doğrular. AWS'e hiç bağlanmaz.

---

## Test Katmanı 2 — Güvenlik taraması (offline, ücretsiz)

```bash
cd terraform
trivy config .
```

Açık S3 bucket, şifrelenmemiş RDS, fazla geniş IAM izni gibi sorunları deploy etmeden yakalar.

---

## Test Katmanı 3 — LocalStack ile gerçek emülasyon

LocalStack, AWS API'lerini `localhost:4566` üzerinde taklit eder. **Cloudflare emüle EDİLMEZ**
(LocalStack yalnız AWS'tir), o yüzden burada Lambda / S3 / DynamoDB / SQS / API Gateway test edilir.

### 3a. LocalStack'i başlat

```bash
docker compose -f .devcontainer/localstack-compose.yml up -d
curl http://localhost:4566/_localstack/health   # servisler "available" görünmeli
```

### 3b. Test için sahte tfvars hazırla

Hazır **dummy** dosyayı kopyalayın — gerçek anahtar gerekmez. `terraform.tfvars`
git'e gitmez (.gitignore'da):

```bash
cd terraform
cp terraform.tfvars.localstack.example terraform.tfvars
```

Bu dosyada `enable_edge = false` ayarlıdır → Cloudflare (`edge`) modülü tamamen
atlanır, çünkü LocalStack Cloudflare'ı emüle etmez.

### 3c. `tflocal` ile plan/apply

`tflocal`, AWS endpoint'lerini otomatik LocalStack'e yönlendiren Terraform wrapper'ıdır
(provider dosyalarını değiştirmenize gerek yok):

```bash
cd terraform
tflocal init
tflocal plan      # ne oluşturulacağını gösterir — hiçbir şey yaratmaz
tflocal apply     # kaynakları LocalStack içinde oluşturur (gerçek AWS değil)
```

> `enable_edge = false` sayesinde Cloudflare modülü plana hiç girmez — artık
> `-target` flag'lerine gerek yok, tüm AWS katmanı tek seferde test edilir.

### 3d. Oluşan kaynakları doğrula

```bash
awslocal s3 ls
awslocal dynamodb list-tables
awslocal sqs list-queues
awslocal lambda list-functions
```

### 3e. Temizlik

```bash
tflocal destroy
docker compose -f .devcontainer/localstack-compose.yml down -v
```

---

## Test Katmanı 4 — Gerçek AWS `plan` (opsiyonel, kaynak OLUŞTURMAZ)

Mimarinin gerçek AWS + Cloudflare ile tutarlılığını görmek isterseniz:

1. Codespace **Secrets**'a gerçek anahtarları girin (repoya ASLA commit etmeyin):
   GitHub ▸ Settings ▸ Codespaces ▸ Secrets — `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
   `TF_VAR_cloudflare_api_token`, `TF_VAR_gemini_api_key`, vb.
2. `terraform plan` çalıştırın — bu **sadece okur**, hiçbir kaynak oluşturmaz.

```bash
cd terraform
terraform plan
```

---

## Önerilen sıra

```
validate  →  trivy config  →  tflocal plan/apply (LocalStack)  →  (ops.) terraform plan
```

Bu zincir, gerçek deploy yapmadan hataların büyük kısmını yakalar.
