# TicaretSitesi

> AI destekli **site oluşturucu** + **pazaryeri** platformu. Kullanıcılar sürükle-bırak editörle web sitesi
> tasarlar, alt alan adıyla yayınlar; aynı platform üzerinde ürün satar, sipariş alır ve Stripe ile
> escrow'lu ödeme yönetir. Yapay zekâ; site planlama, içerik üretme ve pazaryeri sorunlarını çözmede
> asenkron olarak devreye girer.

---

## İçindekiler

- [Mimari](#mimari)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Dizin Yapısı](#dizin-yapısı)
- [Bileşenler](#bileşenler)
  - [Frontend](#frontend)
  - [Backend ve Lambda Servisleri](#backend-ve-lambda-servisleri)
  - [Asenkron AI İş Akışı](#asenkron-ai-iş-akışı)
  - [Veri Katmanı](#veri-katmanı)
  - [Altyapı (AWS / Terraform)](#altyapı-aws--terraform)
- [Kimlik Doğrulama](#kimlik-doğrulama)
- [Ödemeler (Stripe)](#ödemeler-stripe)
- [Yerel Geliştirme](#yerel-geliştirme)
- [Dağıtım (Deployment)](#dağıtım-deployment)
- [Ortam Değişkenleri](#ortam-değişkenleri)

---

## Mimari

![Sistem Mimarisi](docs/architecture.svg)

Platform beş katmandan oluşur:

1. **İstemci & Edge** — Tarayıcı istekleri Cloudflare üzerinden geçer (DNS, SSL, WAF, DDoS koruması).
   Yayınlanan kullanıcı siteleri `*.iluvcode.art` alt alan adlarından statik HTML olarak servis edilir.
2. **Frontend** — Tek sayfalık React uygulaması (SPA). Dashboard, site editörü ve pazaryeri arayüzünü içerir.
3. **API Katmanı** — API Gateway arkasında çalışan Go ile yazılmış HTTP Lambda mikroservisleri. Yerel
   geliştirmede aynı handler'lar tek bir monolitik HTTP sunucusunda (`backend/main.go`) çalışır.
4. **Asenkron İşleme** — Uzun süren işler (AI üretimi, site yayınlama, escrow serbest bırakma) SQS
   kuyruklarına atılır ve worker Lambda'ları tarafından arka planda işlenir.
5. **Veri & Dış Servisler** — RDS PostgreSQL (pgvector ile), S3 kovaları, Stripe, Google Gemini, EasyPost.

---

## Teknoloji Yığını

| Katman        | Teknoloji                                                                 |
|---------------|---------------------------------------------------------------------------|
| Frontend      | React 19, Vite 8, React Router v7, Tailwind CSS 4, Zustand                |
| Backend       | Go 1.26, `net/http`, pgx/v5, sqlc                                         |
| Çalışma ortamı| AWS Lambda (Go, ARM64, `provided.al2023`) + API Gateway HTTP API          |
| Asenkron      | Amazon SQS (`ai-jobs`, `publish`, `finance`)                              |
| Veritabanı    | Amazon RDS PostgreSQL 16 + `pgvector`                                     |
| Depolama      | Amazon S3 (medya varlıkları + yayınlanan siteler)                         |
| Edge / CDN    | Cloudflare (DNS, SSL, WAF)                                                |
| AI            | Google Gemini API                                                        |
| Ödemeler      | Stripe (Connect + escrow)                                                 |
| Kargo         | EasyPost                                                                  |
| Altyapı (IaC) | Terraform                                                                 |
| Yerel ortam   | Docker Compose                                                            |

---

## Dizin Yapısı

```
TicaretSitesi/
├── frontend/              # React 19 + Vite SPA (pazaryeri + site editörü)
├── backend/               # Go: monolitik sunucu + Lambda mikroservisleri
│   ├── main.go            # Yerel geliştirme için monolitik HTTP sunucusu (:8080)
│   ├── cmd/               # Her Lambda servisi için ayrı entrypoint
│   ├── internal/          # Paylaşılan paketler (db, handler, ai, payments, queue...)
│   ├── db/                # PostgreSQL şeması, migration'lar ve sqlc sorguları
│   ├── build/lambda/      # Derlenmiş Lambda zip çıktıları
│   └── build_lambdas.ps1  # Tüm Lambda'ları derleyen script
├── terraform/             # AWS altyapısı (Lambda, RDS, S3, Cloudflare)
├── docs/                  # Mimari diyagramı ve dokümantasyon
├── stitch_minimalist/     # UI tasarım varlıkları / şablonlar
├── docker-compose.yml     # Yerel ortam (PostgreSQL + API + Frontend)
└── deploy_frontend.ps1    # Frontend dağıtım scripti
```

---

## Bileşenler

### Frontend

`frontend/` — Vite ile derlenen React 19 SPA.

- **Durum yönetimi (Zustand):** `useAuthStore` (kimlik), `useCartStore` (sepet), `useEditorStore` (editör).
- **Başlıca ekranlar:**
  - **Dashboard** — Kullanıcının sitelerini listeler ve yeni site oluşturur.
  - **Site Editörü** — Canvas, Inspector, Layers, Elements, Pages panelleri ve AI Builder modalı.
  - **Pazaryeri** — Ürün listeleme, ürün detayı, sepet ve checkout.
  - **Satıcı Paneli** — Siparişler, sorular, bakiye ve Stripe Connect bağlantısı.
  - **Sipariş Takibi** — Alıcı için kargo/sipariş durumu.
- **Yönlendirme:** React Router v7, korumalı rotalar (`ProtectedRoute`) ve lazy-load edilen sayfalar.

### Backend ve Lambda Servisleri

`backend/` Go ile yazılmıştır ve **çift modlu** çalışır: yerelde tek bir monolitik sunucu, AWS'te ise
`cmd/` altındaki her dizin ayrı bir Lambda olarak dağıtılır. Tüm handler mantığı `internal/handler`
içinde paylaşılır; her Lambda `internal/lambdart` üzerinden paylaşılan bağımlılıkları (DB havuzu,
Stripe, Gemini) cold-start optimizasyonuyla yükler.

| Servis (`cmd/`)        | Tetikleyici   | Görev                                                            |
|------------------------|---------------|------------------------------------------------------------------|
| `auth`                 | API Gateway   | Kayıt, giriş, `/me` — JWT üretimi ve doğrulaması                  |
| `sites`                | API Gateway   | Site CRUD, yayınlama / yayından kaldırma                         |
| `products`             | API Gateway   | Satıcı ürün yönetimi, pazaryeri listeleme, ürün soru-cevap       |
| `orders`               | API Gateway   | Sipariş oluşturma ve yönetimi                                    |
| `seller`               | API Gateway   | Satıcı paneli, Stripe Connect, kargo gönderileri                 |
| `buyer`                | API Gateway   | Alıcı profili, adresler, ödeme yöntemleri                        |
| `webhooks`             | API Gateway   | Stripe ve EasyPost webhook'ları (HMAC doğrulamalı)               |
| `domain-router`        | API Gateway   | `*.iluvcode.art` alt alan adlarını S3 sitelerine yönlendirir     |
| `ai-api`               | API Gateway   | Asenkron AI işlerini başlatır (plan / execute / solve)           |
| `ai-worker`            | SQS           | Uzun süren AI işlerini Gemini ile işler                          |
| `publisher`            | SQS           | Site HTML'ini render edip S3'e yükler                            |
| `finance-worker`       | SQS           | Teslimat sonrası escrow serbest bırakma                          |
| `migrate`              | Manuel        | Veritabanı şema migration'larını uygular                         |
| `backfill-embeddings`  | Manuel        | pgvector embedding'lerini geriye dönük doldurur                  |
| `static-serve`         | API Gateway   | Statik varlık servisi (yardımcı)                                 |

`internal/` altındaki paylaşılan paketler: `config` (ortam değişkenleri), `db` (sqlc + migration),
`handler` (HTTP handler'ları), `middleware` (JWT, CORS), `queue` (SQS mesaj tipleri),
`payments` (Stripe istemcisi), `ai` (Gemini istemcisi), `render` (site JSON → HTML).

### Asenkron AI İş Akışı

AI işlemleri uzun sürdüğü için doğrudan HTTP yanıtında değil, kuyruk üzerinden işlenir:

1. Frontend `ai-api` Lambda'sına istek atar (örn. site planı oluştur).
2. `ai-api`, `ai_jobs` tablosuna bir kayıt (`status=pending`) açar ve `ai-jobs` SQS kuyruğuna mesaj atar.
   İstemciye anında bir `job_id` döner.
3. `ai-worker` Lambda'sı kuyruktan mesajı alır, Gemini API'yi çağırır ve ilerledikçe `ai_jobs`
   kaydının olay (event) dizisini ve durumunu günceller.
4. Frontend `job_id` ile durumu **polling** yaparak ilerlemeyi ve nihai sonucu kullanıcıya gösterir.

Aynı desen iki yetenekte kullanılır: **AI Site Builder** (açıklamadan site üretme) ve
**AI Pazaryeri Çözücü** (alıcı sorunlarına çözüm önerme). `GEMINI_API_KEY` tanımlı değilse AI
özellikleri devre dışı kalır, uygulamanın geri kalanı çalışmaya devam eder.

### Veri Katmanı

PostgreSQL 16 + `pgvector`. Şema `backend/db/migrations/` altında sıralı SQL dosyalarıyla yönetilir:

| Migration                  | İçerik                                              |
|----------------------------|-----------------------------------------------------|
| `001_init`                 | Temel tablolar (`users`, `sites`, `pages`, `media`) |
| `002_local_auth`           | Yerel JWT kimlik doğrulama alanları                 |
| `003_ecommerce`            | Sipariş ve e-ticaret tabloları                      |
| `004_storefront`           | Mağaza vitrini                                      |
| `005_marketplace`          | Pazaryeri ürün ve sipariş tabloları                 |
| `006_marketplace_buyers`   | Alıcı profilleri, adresler, ödeme yöntemleri        |
| `007_ai_solver`            | AI çözüm üretici tabloları                          |
| `008_ai_jobs`              | Asenkron AI iş kuyruğu kayıtları                    |

S3 iki kova kullanır: **assets** (kullanıcı medyası) ve **published** (yayınlanan site HTML'leri).

### Altyapı (AWS / Terraform)

`terraform/` AWS kaynaklarını tanımlar (bölge: `eu-central-1` / Frankfurt).

- **Compute:** Lambda fonksiyonları (Go, ARM64) + API Gateway HTTP API.
- **Veri:** RDS PostgreSQL 16, S3 kovaları.
- **Asenkron:** SQS kuyrukları — `ai-jobs`, `publish`, `finance`.
- **Edge:** Cloudflare — `*.iluvcode.art` için DNS, SSL ve WAF.

Modüller `terraform/modules/` altında veri, compute ve edge olarak ayrılmıştır.

---

## Kimlik Doğrulama

Şu an **JWT tabanlı** yerel kimlik doğrulama kullanılır:

- `POST /api/auth/register` ve `POST /api/auth/login` token üretir; `GET /api/auth/me` mevcut
  kullanıcıyı döner.
- Token frontend'de `localStorage`'da tutulur, `Authorization: Bearer <token>` başlığıyla gönderilir.
- `internal/middleware/auth.go`, `JWT_SECRET` ile doğrulama yapar.

Kod içinde `// 🔄 COGNITO_SWITCH:` işaretli noktalar, ileride AWS Cognito'ya geçiş için hazırlanmıştır.

---

## Ödemeler (Stripe)

- **Pazaryeri ödemeleri:** Alıcı ödemesi alınır, platform komisyonu (`PLATFORM_FEE_PERCENT`, varsayılan
  %5) düşülür ve kalan tutar escrow'da tutulur.
- **Escrow serbest bırakma:** Teslimat onayından sonra (`ESCROW_RELEASE_DAYS`, varsayılan 7 gün)
  `finance-worker` Lambda'sı satıcıya ödemeyi serbest bırakır.
- **Stripe Connect:** Satıcılar `POST /api/seller/connect` ile kendi Stripe hesaplarını bağlar.
- **Webhook'lar:** `webhooks` Lambda'sı Stripe ve EasyPost olaylarını HMAC doğrulamasıyla işler.

---

## Yerel Geliştirme

**Gereksinimler:** Docker, Go 1.26+, Node.js 20+.

### Docker Compose ile (önerilen)

```powershell
docker compose up
```

PostgreSQL, Go API ve frontend birlikte ayağa kalkar.

### Manuel

```powershell
# Backend (monolitik sunucu, :8080)
cd backend
./run_dev.ps1

# Frontend (Vite dev sunucusu)
cd frontend
npm install
npm run dev
```

> **Not:** Yerel makinede çalışan native PostgreSQL `5432` portunu kullanıyorsa, dev container ile
> çakışır. Dev container için `5433` portunu kullanın.

---

## Dağıtım (Deployment)

```powershell
# 1. Lambda fonksiyonlarını derle (Go → linux/arm64 zip)
cd backend
./build_lambdas.ps1

# 2. Altyapıyı uygula
cd ../terraform
./tf-deploy.ps1

# 3. Frontend'i derleyip dağıt
./deploy_frontend.ps1
```

Veritabanı şeması, ilk kurulumda `migrate` Lambda'sı manuel tetiklenerek uygulanır.

---

## Ortam Değişkenleri

`.env` dosyasında tanımlanır (örnek değerler):

```bash
# Veritabanı
DATABASE_URL=postgres://user:pass@host:5432/db

# Uygulama
PORT=8080
APP_DOMAIN=iluvcode.art
FRONTEND_BASE_URL=http://localhost

# Kimlik doğrulama
JWT_SECRET=...

# AI
GEMINI_API_KEY=...

# Ödemeler
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PLATFORM_FEE_PERCENT=5
ESCROW_RELEASE_DAYS=7

# AWS / Depolama
S3_ASSETS_BUCKET=...
S3_PUBLISHED_BUCKET=...
```

Lambda ortamında veritabanı bağlantısı `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
değişkenleriyle ayrı ayrı verilir.
