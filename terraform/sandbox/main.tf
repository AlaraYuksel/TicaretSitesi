# ═══════════════════════════════════════════════════════════════════════════════
# FAZ 0 — İzole Terraform Smoke Test
# ═══════════════════════════════════════════════════════════════════════════════
# Amaç: AWS kimlik bilgilerinin ve terraform apply/destroy döngüsünün gerçek AWS'te
# çalıştığını, ana projeye DOKUNMADAN doğrulamak.
#
# Bu config tamamen izoledir — kendi local state'i vardır (terraform/sandbox/),
# ana terraform/ state'inden bağımsızdır.
#
# Kullanım:
#   cd terraform/sandbox
#   terraform init
#   terraform apply        # -> 1 adet S3 bucket oluşturur
#   terraform output       # -> bucket adını gösterir
#   terraform destroy      # -> bucket'ı siler, hiçbir iz kalmaz
# ═══════════════════════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "marketplace"
      Purpose   = "terraform-smoke-test"
      ManagedBy = "Terraform"
    }
  }
}

variable "aws_region" {
  description = "AWS bölgesi (ana proje ile aynı: Frankfurt)"
  type        = string
  default     = "eu-central-1"
}

# Bucket adlarının global benzersiz olması gerekir — rastgele sonek ekle
resource "random_id" "suffix" {
  byte_length = 4
}

# Smoke test için tek kaynak: bir S3 bucket
resource "aws_s3_bucket" "smoketest" {
  bucket = "marketplace-tf-smoketest-${random_id.suffix.hex}"
}

# Bucket'ın güvenli olması için public erişimi kapat (en iyi pratik)
resource "aws_s3_bucket_public_access_block" "smoketest" {
  bucket                  = aws_s3_bucket.smoketest.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "smoketest_bucket_name" {
  description = "Oluşturulan smoke test bucket adı — AWS Console'da doğrulayın"
  value       = aws_s3_bucket.smoketest.id
}

output "smoketest_bucket_arn" {
  value = aws_s3_bucket.smoketest.arn
}

output "next_step" {
  value = "Bucket'i AWS Console > S3'te gördükten sonra: terraform destroy"
}
