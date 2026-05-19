# ═══════════════════════════════════════════════════════════════════════════════
# AI MODÜLÜ — Asenkron AI iş kuyruğu
#
# AI işlemleri (plan/execute/solve) ~1-2 dk sürer — API Gateway 30sn limitini
# aşar; ayrıca sandbox hesabı public Lambda Function URL'leri engelliyor.
# Çözüm: asenkron iş kuyruğu.
#   - ai-api    Lambda (API Gateway): işi başlatır (ai_jobs + SQS), durum verir.
#   - ai-worker Lambda (SQS tüketici): işi çalıştırır, sonucu ai_jobs'a yazar.
# Hiçbir Function URL yok → sandbox 403 sorunu tamamen ortadan kalkar.
#
# NOT: chatbot/product-qa/vision/recommendation Lambda'larının backend kodu
# henüz yok — bu modülde tanımlı değiller (kodları yazılınca eklenecek).
# ═══════════════════════════════════════════════════════════════════════════════

variable "name_prefix"               { type = string }
variable "aws_region"                { type = string }
variable "vpc_id"                    { type = string }
variable "private_subnet_ids"        { type = list(string) }
variable "lambda_env_common"         { type = map(string) }
variable "lambda_artifacts_dir"      { type = string }
variable "gemini_api_key" {
  type      = string
  sensitive = true
}
variable "gemini_model"              { type = string }
variable "ses_sender_email"          { type = string }
variable "dynamodb_table_arn"        { type = string }
variable "dynamodb_table_name"       { type = string }
variable "s3_assets_bucket_arn"      { type = string }
variable "s3_published_bucket_arn"   { type = string }
variable "eventbridge_bus_arn"       { type = string }
variable "eventbridge_bus_name"      { type = string }
variable "lambda_sg_id"              { type = string }
variable "api_gateway_id"            { type = string }
variable "api_gateway_execution_arn" { type = string }
variable "sqs_ai_jobs_queue_arn"     { type = string }
variable "sqs_ai_jobs_queue_url"     { type = string }

locals {
  ai_zip = {
    "ai-api"    = "${var.lambda_artifacts_dir}/ai-api/ai-api.zip"
    "ai-worker" = "${var.lambda_artifacts_dir}/ai-worker/ai-worker.zip"
  }
}

# ─── IAM Role ────────────────────────────────────────────────────────────────
resource "aws_iam_role" "ai_lambda" {
  name = "${var.name_prefix}-ai-lambda"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy_attachment" "ai_logs" {
  role       = aws_iam_role.ai_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "ai_vpc" {
  role       = aws_iam_role.ai_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# AI Lambda'ları yalnızca ai-jobs SQS kuyruğuna erişir (RDS'e VPC üzerinden).
resource "aws_iam_role_policy" "ai_services" {
  name = "${var.name_prefix}-ai-services"
  role = aws_iam_role.ai_lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = [var.sqs_ai_jobs_queue_arn]
      }
    ]
  })
}

# ─── Log Grupları (terraform yönetiminde — destroy temiz, retention 3 gün) ────
resource "aws_cloudwatch_log_group" "ai_lambda" {
  for_each          = local.ai_zip
  name              = "/aws/lambda/${var.name_prefix}-${each.key}"
  retention_in_days = 3
}

# ═══════════════════════════════════════════════════════════════════════════════
# ai-api Lambda — AI HTTP endpoint'leri (API Gateway)
# ═══════════════════════════════════════════════════════════════════════════════
resource "aws_lambda_function" "ai_api" {
  function_name    = "${var.name_prefix}-ai-api"
  role             = aws_iam_role.ai_lambda.arn
  handler          = "bootstrap"
  runtime          = "provided.al2023"
  architectures    = ["arm64"]
  timeout          = 15
  memory_size      = 256
  filename         = local.ai_zip["ai-api"]
  source_code_hash = filebase64sha256(local.ai_zip["ai-api"])
  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_sg_id]
  }
  environment {
    variables = merge(var.lambda_env_common, {
      FUNCTION_NAME  = "ai-api"
      GEMINI_API_KEY = var.gemini_api_key
      GEMINI_MODEL   = var.gemini_model
      SQS_AIJOBS_URL = var.sqs_ai_jobs_queue_url
    })
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# ai-worker Lambda — AI iş kuyruğu tüketicisi (SQS)
# ═══════════════════════════════════════════════════════════════════════════════
resource "aws_lambda_function" "ai_worker" {
  function_name    = "${var.name_prefix}-ai-worker"
  role             = aws_iam_role.ai_lambda.arn
  handler          = "bootstrap"
  runtime          = "provided.al2023"
  architectures    = ["arm64"]
  timeout          = 900 # AI ajanı ~1-2 dk; geniş pay
  memory_size      = 1024
  filename         = local.ai_zip["ai-worker"]
  source_code_hash = filebase64sha256(local.ai_zip["ai-worker"])
  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_sg_id]
  }
  environment {
    variables = merge(var.lambda_env_common, {
      FUNCTION_NAME  = "ai-worker"
      GEMINI_API_KEY = var.gemini_api_key
      GEMINI_MODEL   = var.gemini_model
    })
  }
}

resource "aws_lambda_event_source_mapping" "ai_jobs" {
  event_source_arn = var.sqs_ai_jobs_queue_arn
  function_name    = aws_lambda_function.ai_worker.arn
  batch_size       = 1
  enabled          = true
}

# ═══════════════════════════════════════════════════════════════════════════════
# API Gateway — AI HTTP route'ları → ai-api Lambda
# ═══════════════════════════════════════════════════════════════════════════════
resource "aws_apigatewayv2_integration" "ai_api" {
  api_id                 = var.api_gateway_id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.ai_api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "ai" {
  for_each = toset([
    "POST /api/ai/build-site/plan",
    "POST /api/ai/build-site/execute",
    "POST /api/marketplace/ai-solver/solve",
    "GET /api/ai/jobs/{id}",
    "POST /api/marketplace/ai-solver/solutions",
    "GET /api/marketplace/ai-solver/solutions",
    "GET /api/marketplace/ai-solver/solutions/{id}",
  ])
  api_id    = var.api_gateway_id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.ai_api.id}"
}

resource "aws_lambda_permission" "apigw_ai_api" {
  statement_id  = "AllowAPIGatewayInvoke-ai-api"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ai_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
