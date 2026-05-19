# Proje — BTK Akademi × Google Hackathon

## Ne yapıyor?

Yapay zeka destekli **web sitesi tasarım platformu + pazaryeri**. Kullanıcı kod
yazmadan (veya doğal dille AI'a anlatarak) sitesini kurar; site
`kullanıcıadı.iluvcode.art` adresinden yayınlanır ve ürünleri otomatik olarak
ortak bir **pazaryerinde** listelenir.

## 🤖 Yapay Zeka (Google Gemini)

- **AI Site Builder** — Kullanıcı ne istediğini yazar, Gemini 2.5 Pro
  *function calling* ile tüm siteyi (sayfa, element, tema) kurar.
- **AI Çözüm Asistanı** — Alıcı sorununu anlatır, AI **pgvector anlamsal arama**
  ile ilgili ürünleri bulup çok ürünlü çözüm paketi önerir.
- **Embedding** — Ürünler **Gemini Embedding API** ile 768 boyutlu vektörlere
  çevrilip pgvector'de saklanır.
- AI işlemleri **asenkron iş kuyruğu** (SQS + worker) ile çalışır.

## 🏗️ Mimari

Tamamen **serverless**, **Terraform** ile yönetilen AWS + Cloudflare.

- **Frontend:** React 19 + Vite — görsel site editörü + pazaryeri
- **Backend:** Go — 16 AWS Lambda fonksiyonu
- **Veritabanı:** RDS PostgreSQL 16 + **pgvector**
- **Altyapı:** API Gateway, S3, SQS, VPC; Cloudflare (CDN, WAF, SSL, DDoS)

## 🔌 Teknolojiler

**Google Gemini API** (function calling, structured output, embedding) ·
Stripe + Connect (ödeme, escrow) · EasyPost (kargo) · AWS · Cloudflare ·
Terraform · Go · React

## 🎬 Demo

AI siteyi kurar → site yayınlanır, ürünler pazaryerine düşer → alıcı sorununu
yazar, AI çözüm paketi önerir → Stripe ödeme + EasyPost kargo.
