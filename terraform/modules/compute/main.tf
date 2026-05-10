# ═══════════════════════════════════════════════════════════════════════════════
# COMPUTE MODÜLÜ — Lambda (Go) + API Gateway
# ═══════════════════════════════════════════════════════════════════════════════

variable "name_prefix"              { type = string }
variable "aws_region"               { type = string }
variable "vpc_id"                   { type = string }
variable "private_subnet_ids"       { type = list(string) }
variable "lambda_env_common"        { type = map(string) }
variable "stripe_secret_key"        { type = string; sensitive = true }
variable "stripe_webhook_secret"    { type = string; sensitive = true }
variable "stripe_connect_client_id" { type = string }
variable "easypost_api_key"         { type = string; sensitive = true }
variable "easypost_webhook_secret"  { type = string; sensitive = true }
variable "sqs_finance_queue_arn"    { type = string }
variable "sqs_finance_queue_url"    { type = string }
variable "sqs_publish_queue_arn"    { type = string }
variable "sqs_publish_queue_url"    { type = string }
variable "sqs_notifications_queue_arn" { type = string }
variable "sqs_notifications_queue_url" { type = string }
variable "eventbridge_bus_arn"      { type = string }
variable "rds_endpoint"             { type = string }
variable "dynamodb_table_name"      { type = string }
variable "dynamodb_table_arn"       { type = string }
variable "s3_assets_bucket"         { type = string }
variable "s3_assets_bucket_arn"     { type = string }
variable "s3_published_bucket"      { type = string }
variable "s3_published_bucket_arn"  { type = string }
variable "rds_security_group_id"    { type = string }

# ─── Lambda Security Group ───────────────────────────────────────────────────
resource "aws_security_group" "lambda" {
  name_prefix = "${var.name_prefix}-lambda-"
  vpc_id      = var.vpc_id
  description = "Lambda — internet cikisi (NAT) + RDS erisimi"

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name_prefix}-lambda-sg" }
}

# ─── IAM Role ────────────────────────────────────────────────────────────────
resource "aws_iam_role" "lambda_exec" {
  name = "${var.name_prefix}-lambda-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "lambda_services" {
  name = "${var.name_prefix}-lambda-services"
  role = aws_iam_role.lambda_exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["sqs:SendMessage","sqs:ReceiveMessage","sqs:DeleteMessage","sqs:GetQueueAttributes"], Resource = [var.sqs_finance_queue_arn, var.sqs_publish_queue_arn, var.sqs_notifications_queue_arn] },
      { Effect = "Allow", Action = ["dynamodb:GetItem","dynamodb:PutItem","dynamodb:UpdateItem","dynamodb:DeleteItem","dynamodb:Query","dynamodb:Scan"], Resource = [var.dynamodb_table_arn, "${var.dynamodb_table_arn}/index/*"] },
      { Effect = "Allow", Action = ["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:ListBucket"], Resource = [var.s3_assets_bucket_arn, "${var.s3_assets_bucket_arn}/*", var.s3_published_bucket_arn, "${var.s3_published_bucket_arn}/*"] },
      { Effect = "Allow", Action = ["events:PutEvents"], Resource = [var.eventbridge_bus_arn] },
      { Effect = "Allow", Action = ["ses:SendEmail","ses:SendRawEmail"], Resource = ["*"] },
      { Effect = "Allow", Action = ["polly:SynthesizeSpeech"], Resource = ["*"] },
      { Effect = "Allow", Action = ["cloudfront:CreateInvalidation"], Resource = ["*"] }
    ]
  })
}

# ─── Placeholder zip ─────────────────────────────────────────────────────────
data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "${path.module}/placeholder.zip"
  source { content = "placeholder"; filename = "bootstrap" }
}

locals {
  common_lambda = {
    role          = aws_iam_role.lambda_exec.arn
    handler       = "bootstrap"
    runtime       = "provided.al2023"
    architectures = ["arm64"]
    filename      = data.archive_file.placeholder.output_path
    hash          = data.archive_file.placeholder.output_base64sha256
    subnets       = var.private_subnet_ids
    sg            = [aws_security_group.lambda.id]
  }
}
