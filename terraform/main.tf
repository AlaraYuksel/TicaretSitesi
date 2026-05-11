# ═══════════════════════════════════════════════════════════════════════════════
# Marketplace + AI — AWS + Cloudflare Terraform Ana Konfigürasyonu
# ═══════════════════════════════════════════════════════════════════════════════
#
# Mimari Katmanlar:
#   1. Edge       — Cloudflare CDN + WAF + Universal SSL (CloudFront KALDIRILDI)
#   2. Compute    — Lambda (Go Runtime), API Gateway + Custom Domain
#   3. Data       — RDS PostgreSQL (pgvector), DynamoDB, S3
#   4. Async      — SQS kuyrukları (Finance, Publish, Notifications), EventBridge
#   5. AI         — Gemini API entegrasyonu Lambda'lar
#   6. Publish    — Publisher Lambda, Finance Worker Lambda, Polly TTS
#   7. Domain     — Cloudflare DNS, ACM (eu-central-1)
#
# Domain Akışı:
#   iluvcode.art        → API Gateway → React SPA + API endpoints
#   *.iluvcode.art      → Lambda Function URL → Published Sites (S3)
#   ahmet.iluvcode.art  → Domain Router Lambda → S3/{ahmet}/index.html
# ═══════════════════════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  # ── Remote State (S3 + DynamoDB Lock) ──────────────────────────────────────
  # backend "s3" {
  #   bucket         = "marketplace-tf-state"
  #   key            = "marketplace/terraform.tfstate"
  #   region         = "eu-central-1"
  #   dynamodb_table = "terraform-locks"
  #   encrypt        = true
  # }
}

# ── AWS Provider (eu-central-1 — Türkiye'ye en yakın) ────────────────────────
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(var.tags, {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    })
  }
}

# ── Cloudflare Provider ──────────────────────────────────────────────────────
# us-east-1 provider KALDIRILDI — CloudFront olmadan artık gerekli değil
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ─── Ortak etiketler ─────────────────────────────────────────────────────────
locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  })

  # Lambda ortam değişkenleri — tüm fonksiyonlar için ortak
  lambda_env_common = {
    ENVIRONMENT     = var.environment
    DB_HOST         = module.data.rds_endpoint
    DB_PORT         = "5432"
    DB_NAME         = var.db_name
    DB_USER         = var.db_username
    DB_PASSWORD     = var.db_password
    DYNAMODB_TABLE  = module.data.dynamodb_table_name
    JWT_SECRET      = var.jwt_secret
    GEMINI_API_KEY  = var.gemini_api_key
    GEMINI_MODEL    = var.gemini_model
    S3_ASSETS_BUCKET    = module.data.s3_assets_bucket
    S3_PUBLISHED_BUCKET = module.data.s3_published_bucket
    DOMAIN_NAME         = var.domain_name
    CLOUDFLARE_API_TOKEN = var.cloudflare_api_token
    CLOUDFLARE_ZONE_ID   = module.edge.cloudflare_zone_id
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# MODÜLLER
# ═══════════════════════════════════════════════════════════════════════════════

# ── 1. NETWORKING (VPC) ─────────────────────────────────────────────────────
module "networking" {
  source = "./modules/networking"

  name_prefix = local.name_prefix
  aws_region  = var.aws_region
}

# ── 2. DATA KATMANI ─────────────────────────────────────────────────────────
# RDS PostgreSQL + pgvector, DynamoDB, S3 bucket'ları
module "data" {
  source = "./modules/dataL"

  name_prefix       = local.name_prefix
  vpc_id            = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  db_username       = var.db_username
  db_password       = var.db_password
  db_name           = var.db_name
  db_instance_class = var.db_instance_class
  domain_name       = var.domain_name
  lambda_sg_id      = module.compute.lambda_security_group_id
}

# ── 3. ASYNC KATMANI ────────────────────────────────────────────────────────
# SQS kuyrukları (Finance, Publish, Notifications) + EventBridge
module "async" {
  source = "./modules/async"

  name_prefix = local.name_prefix
}

# ── 4. COMPUTE KATMANI ──────────────────────────────────────────────────────
# Lambda fonksiyonları + API Gateway + Custom Domain + Domain Router
module "compute" {
  source = "./modules/compute"

  name_prefix        = local.name_prefix
  aws_region         = var.aws_region
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  domain_name        = var.domain_name

  # Lambda ortam değişkenleri
  lambda_env_common = local.lambda_env_common

  # Stripe & EasyPost
  stripe_secret_key        = var.stripe_secret_key
  stripe_webhook_secret    = var.stripe_webhook_secret
  stripe_connect_client_id = var.stripe_connect_client_id
  easypost_api_key         = var.easypost_api_key
  easypost_webhook_secret  = var.easypost_webhook_secret

  # SQS ARN'leri
  sqs_finance_queue_arn       = module.async.sqs_finance_queue_arn
  sqs_finance_queue_url       = module.async.sqs_finance_queue_url
  sqs_publish_queue_arn       = module.async.sqs_publish_queue_arn
  sqs_publish_queue_url       = module.async.sqs_publish_queue_url
  sqs_notifications_queue_arn = module.async.sqs_notifications_queue_arn
  sqs_notifications_queue_url = module.async.sqs_notifications_queue_url
  eventbridge_bus_arn         = module.async.eventbridge_bus_arn

  # Data layer referansları
  rds_endpoint            = module.data.rds_endpoint
  dynamodb_table_name     = module.data.dynamodb_table_name
  dynamodb_table_arn      = module.data.dynamodb_table_arn
  s3_assets_bucket        = module.data.s3_assets_bucket
  s3_assets_bucket_arn    = module.data.s3_assets_bucket_arn
  s3_published_bucket     = module.data.s3_published_bucket
  s3_published_bucket_arn = module.data.s3_published_bucket_arn
  s3_react_bucket         = module.data.s3_react_bucket
  s3_react_bucket_arn     = module.data.s3_react_bucket_arn
  rds_security_group_id   = module.data.rds_security_group_id
}

# ── 5. AI KATMANI ───────────────────────────────────────────────────────────
# Chatbot, Product Q&A, Vision, Site Builder Agent, Öneri lambdaları
module "ai" {
  source = "./modules/ai"

  name_prefix        = local.name_prefix
  aws_region         = var.aws_region
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids

  lambda_env_common   = local.lambda_env_common
  gemini_api_key      = var.gemini_api_key
  gemini_model        = var.gemini_model
  ses_sender_email    = var.ses_sender_email

  dynamodb_table_arn  = module.data.dynamodb_table_arn
  dynamodb_table_name = module.data.dynamodb_table_name
  s3_assets_bucket_arn = module.data.s3_assets_bucket_arn
  s3_published_bucket_arn = module.data.s3_published_bucket_arn
  eventbridge_bus_arn = module.async.eventbridge_bus_arn
  eventbridge_bus_name = module.async.eventbridge_bus_name

  lambda_sg_id = module.compute.lambda_security_group_id

  api_gateway_id          = module.compute.api_gateway_id
  api_gateway_execution_arn = module.compute.api_gateway_execution_arn
}

# ── 6. EDGE KATMANI ─────────────────────────────────────────────────────────
# Cloudflare DNS + CDN + SSL + WAF (CloudFront KALDIRILDI)
module "edge" {
  source = "./modules/edge"

  name_prefix           = local.name_prefix
  domain_name           = var.domain_name
  cloudflare_account_id = var.cloudflare_account_id

  # API Gateway Custom Domain hedefi
  api_gw_custom_domain_target = module.compute.api_gw_custom_domain_target

  # Lambda Function URL domain (wildcard subdomain'ler için)
  domain_router_url_domain = module.compute.domain_router_url_domain

  # ACM sertifika DNS doğrulaması Cloudflare üzerinden
  acm_cert_validation_records = module.compute.acm_cert_validation_records
}
