# ═══════════════════════════════════════════════════════════════════════════════
# DATA MODÜLÜ — RDS PostgreSQL (pgvector), DynamoDB, S3 Bucket'ları
# Mimari Diyagram: "Veri Katmanı"
# ═══════════════════════════════════════════════════════════════════════════════

variable "name_prefix"        { type = string }
variable "vpc_id"             { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "db_username"        { type = string }
variable "db_password" {
  type      = string
  sensitive = true
}
variable "db_name"            { type = string }
variable "db_instance_class"  { type = string }
variable "domain_name"        { type = string }
variable "lambda_sg_id"       { type = string }

# ═══════════════════════════════════════════════════════════════════════════════
# 1. RDS PostgreSQL + pgvector
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_db_subnet_group" "main" {
  name       = "${var.name_prefix}-db-subnet"
  subnet_ids = var.private_subnet_ids
  tags       = { Name = "${var.name_prefix}-db-subnet" }
}

resource "aws_security_group" "rds" {
  name_prefix = "${var.name_prefix}-rds-"
  vpc_id      = var.vpc_id
  description = "RDS PostgreSQL — sadece Lambda SG'den erişim"

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.lambda_sg_id]
    description     = "Lambda -> RDS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name_prefix}-rds-sg" }
}

resource "aws_db_parameter_group" "postgres16" {
  name_prefix = "${var.name_prefix}-pg16-"
  family      = "postgres16"
  description = "PostgreSQL 16 — pgvector + performans ayarları"

  # pgvector eklentisini paylaşılan kütüphanelere ekle
  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  # Bağlantı havuzu optimizasyonu
  parameter {
    name  = "max_connections"
    value = "100"
  }

  tags = { Name = "${var.name_prefix}-pg-params" }
}

resource "aws_db_instance" "main" {
  identifier = "${var.name_prefix}-postgres"

  engine         = "postgres"
  engine_version = "16.4"
  instance_class = var.db_instance_class

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres16.name

  multi_az            = false  # MVP — prod'da true yapılacak
  publicly_accessible = false
  skip_final_snapshot = true
  deletion_protection = false  # MVP — prod'da true

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Sun:04:00-Sun:05:00"

  tags = { Name = "${var.name_prefix}-rds" }
}

# ═══════════════════════════════════════════════════════════════════════════════
# 2. DynamoDB — Session, Cart, Chat History, Öneri Cache
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_dynamodb_table" "main" {
  name         = "${var.name_prefix}-store"
  billing_mode = "PAY_PER_REQUEST"  # Free tier: 25 RCU + 25 WCU
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # GSI: Ters sorgu (ör: ürünün tüm siparişleri)
  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  # TTL: Chat geçmişi, session, cache otomatik silinir
  ttl {
    attribute_name = "ExpiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = { Name = "${var.name_prefix}-dynamodb" }
}

# ═══════════════════════════════════════════════════════════════════════════════
# 3. S3 Bucket'ları
# ═══════════════════════════════════════════════════════════════════════════════

# ── S3: React/Vite Build ─────────────────────────────────────────────────────
resource "aws_s3_bucket" "react" {
  bucket = "${var.name_prefix}-react-app"
  tags   = { Name = "${var.name_prefix}-react" }
}

resource "aws_s3_bucket_versioning" "react" {
  bucket = aws_s3_bucket.react.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "react" {
  bucket                  = aws_s3_bucket.react.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── S3: User Assets (ürün görselleri, medya) ─────────────────────────────────
resource "aws_s3_bucket" "assets" {
  bucket = "${var.name_prefix}-user-assets"
  tags   = { Name = "${var.name_prefix}-assets" }
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["https://${var.domain_name}", "https://*.${var.domain_name}"]
    max_age_seconds = 3600
  }
}

# ── S3: Published Sites (yayınlanan satıcı siteleri) ────────────────────────
resource "aws_s3_bucket" "published" {
  bucket = "${var.name_prefix}-published-sites"
  tags   = { Name = "${var.name_prefix}-published" }
}

resource "aws_s3_bucket_versioning" "published" {
  bucket = aws_s3_bucket.published.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "published" {
  bucket                  = aws_s3_bucket.published.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ═══════════════════════════════════════════════════════════════════════════════
# OUTPUTS
# ═══════════════════════════════════════════════════════════════════════════════

output "rds_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "rds_security_group_id" {
  value = aws_security_group.rds.id
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.main.name
}

output "dynamodb_table_arn" {
  value = aws_dynamodb_table.main.arn
}

output "s3_react_bucket" {
  value = aws_s3_bucket.react.id
}

output "s3_react_bucket_arn" {
  value = aws_s3_bucket.react.arn
}

output "s3_react_bucket_domain" {
  value = aws_s3_bucket.react.bucket_regional_domain_name
}

output "s3_assets_bucket" {
  value = aws_s3_bucket.assets.id
}

output "s3_assets_bucket_arn" {
  value = aws_s3_bucket.assets.arn
}

output "s3_assets_bucket_domain" {
  value = aws_s3_bucket.assets.bucket_regional_domain_name
}

output "s3_published_bucket" {
  value = aws_s3_bucket.published.id
}

output "s3_published_bucket_arn" {
  value = aws_s3_bucket.published.arn
}

output "s3_published_bucket_domain" {
  value = aws_s3_bucket.published.bucket_regional_domain_name
}
