# ═══════════════════════════════════════════════════════════════════════════════
# Marketplace + AI — AWS Terraform Ana Konfigürasyonu
# ═══════════════════════════════════════════════════════════════════════════════
#
# Mimari Katmanlar:
#   1. Edge       — CloudFront CDN, WAF, ACM SSL
#   2. Compute    — Lambda (Go Runtime), API Gateway
#   3. Data       — RDS PostgreSQL (pgvector), DynamoDB, S3
#   4. Async      — SQS kuyrukları (Finance, Publish, Notifications), EventBridge
#   5. AI         — Claude API entegrasyonu Lambda'lar
#   6. Publish    — Publisher Lambda, Finance Worker Lambda, Polly TTS
#   7. Domain     — Route 53, ACM
# ═══════════════════════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # ── Remote State (S3 + DynamoDB Lock) ──────────────────────────────────────
  # İlk çalıştırmada state bucket'ı manuel oluşturmanız gerekir:
  #   aws s3 mb s3://YOUR-BUCKET-NAME --region eu-central-1
  #   aws dynamodb create-table --table-name terraform-locks \
  #     --attribute-definitions AttributeName=LockID,AttributeType=S \
  #     --key-schema AttributeName=LockID,KeyType=HASH \
  #     --billing-mode PAY_PER_REQUEST
  #
  # Aşağıdaki backend bloğunu aktif etmek için .env.template'i doldurun.
  # İlk seferde lokal state kullanmak isterseniz bu bloğu yorum satırı yapın.
  #
  # backend "s3" {
  #   bucket         = "marketplace-tf-state"
  #   key            = "marketplace/terraform.tfstate"
  #   region         = "eu-central-1"
  #   dynamodb_table = "terraform-locks"
  #   encrypt        = true
  # }
}

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

# CloudFront + ACM için us-east-1 provider gerekli
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = merge(var.tags, {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    })
  }
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
    ANTHROPIC_API_KEY = var.anthropic_api_key
    CLAUDE_MODEL    = var.claude_model
    S3_ASSETS_BUCKET    = module.data.s3_assets_bucket
    S3_PUBLISHED_BUCKET = module.data.s3_published_bucket
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
  source = "./modules/data"

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
# Lambda fonksiyonları + API Gateway
module "compute" {
  source = "./modules/compute"

  name_prefix        = local.name_prefix
  aws_region         = var.aws_region
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids

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
  rds_endpoint        = module.data.rds_endpoint
  dynamodb_table_name = module.data.dynamodb_table_name
  dynamodb_table_arn  = module.data.dynamodb_table_arn
  s3_assets_bucket    = module.data.s3_assets_bucket
  s3_assets_bucket_arn = module.data.s3_assets_bucket_arn
  s3_published_bucket = module.data.s3_published_bucket
  s3_published_bucket_arn = module.data.s3_published_bucket_arn
  rds_security_group_id = module.data.rds_security_group_id
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
  anthropic_api_key   = var.anthropic_api_key
  claude_model        = var.claude_model
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
# CloudFront, WAF, ACM SSL
module "edge" {
  source = "./modules/edge"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name_prefix        = local.name_prefix
  domain_name        = var.domain_name
  route53_zone_id    = var.route53_zone_id
  s3_react_bucket_domain  = module.data.s3_react_bucket_domain
  s3_react_bucket_arn     = module.data.s3_react_bucket_arn
  s3_assets_bucket_domain = module.data.s3_assets_bucket_domain
  s3_published_bucket_domain = module.data.s3_published_bucket_domain
  s3_published_bucket_arn    = module.data.s3_published_bucket_arn
  api_gateway_invoke_url  = module.compute.api_gateway_invoke_url
}
