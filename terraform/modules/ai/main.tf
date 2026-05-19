# ═══════════════════════════════════════════════════════════════════════════════
# AI MODÜLÜ — Site Builder + AI Solver Lambda'ları
#
# AI/SSE endpoint'leri API Gateway DEĞİL, Lambda Function URL (RESPONSE_STREAM)
# kullanır: API Gateway HTTP API'nin 30sn limiti ve buffer'lama davranışı
# canlı ilerleme akışını (SSE) ve 15dk'lık site builder ajanını desteklemez.
#
# NOT: chatbot / product-qa / vision / recommendation Lambda'larının backend
# kodu henüz yok — bu yüzden aşağıda YORUM SATIRINA alındılar (silinmediler;
# kodları yazılınca geri açılacak).
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

locals {
  ai_zip = {
    "ai-site-builder" = "${var.lambda_artifacts_dir}/ai-site-builder/ai-site-builder.zip"
    "ai-solver"       = "${var.lambda_artifacts_dir}/ai-solver/ai-solver.zip"
  }
}

# AI Lambda log grupları — terraform yönetiminde (destroy temiz, retention 3 gün)
resource "aws_cloudwatch_log_group" "ai_lambda" {
  for_each          = local.ai_zip
  name              = "/aws/lambda/${var.name_prefix}-${each.key}"
  retention_in_days = 3
}

# ─── AI Lambda IAM Role ─────────────────────────────────────────────────────
resource "aws_iam_role" "ai_lambda" {
  name = "${var.name_prefix}-ai-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
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

resource "aws_iam_role_policy" "ai_services" {
  name = "${var.name_prefix}-ai-services"
  role = aws_iam_role.ai_lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"], Resource = [var.dynamodb_table_arn, "${var.dynamodb_table_arn}/index/*"] },
      { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = ["${var.s3_assets_bucket_arn}/*", "${var.s3_published_bucket_arn}/*"] },
      { Effect = "Allow", Action = ["polly:SynthesizeSpeech"], Resource = ["*"] },
      { Effect = "Allow", Action = ["ses:SendEmail"], Resource = ["*"] },
      { Effect = "Allow", Action = ["events:PutEvents"], Resource = [var.eventbridge_bus_arn] }
    ]
  })
}

# ═══════════════════════════════════════════════════════════════════════════════
# AI SITE BUILDER λ — Lambda Function URL + RESPONSE_STREAM
# ═══════════════════════════════════════════════════════════════════════════════
resource "aws_lambda_function" "site_builder" {
  function_name    = "${var.name_prefix}-ai-site-builder"
  role             = aws_iam_role.ai_lambda.arn
  handler          = "bootstrap"
  runtime          = "provided.al2023"
  architectures    = ["arm64"]
  timeout          = 900 # 15 dakika — multi-turn AI agent
  memory_size      = 1024
  filename         = local.ai_zip["ai-site-builder"]
  source_code_hash = filebase64sha256(local.ai_zip["ai-site-builder"])
  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_sg_id]
  }
  environment {
    variables = merge(var.lambda_env_common, {
      FUNCTION_NAME  = "ai-site-builder"
      GEMINI_API_KEY = var.gemini_api_key
      GEMINI_MODEL   = "gemini-2.5-pro" # site-builder için sabit model
    })
  }
}

resource "aws_lambda_function_url" "site_builder" {
  function_name      = aws_lambda_function.site_builder.function_name
  authorization_type = "NONE"
  invoke_mode        = "RESPONSE_STREAM"

  cors {
    allow_origins = ["*"]
    allow_methods = ["*"]
    allow_headers = ["content-type", "authorization"]
    max_age       = 3600
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# AI SOLVER λ — Lambda Function URL + RESPONSE_STREAM
# ═══════════════════════════════════════════════════════════════════════════════
resource "aws_lambda_function" "ai_solver" {
  function_name    = "${var.name_prefix}-ai-solver"
  role             = aws_iam_role.ai_lambda.arn
  handler          = "bootstrap"
  runtime          = "provided.al2023"
  architectures    = ["arm64"]
  timeout          = 300
  memory_size      = 512
  filename         = local.ai_zip["ai-solver"]
  source_code_hash = filebase64sha256(local.ai_zip["ai-solver"])
  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_sg_id]
  }
  environment {
    variables = merge(var.lambda_env_common, {
      FUNCTION_NAME  = "ai-solver"
      GEMINI_API_KEY = var.gemini_api_key
      GEMINI_MODEL   = var.gemini_model
    })
  }
}

resource "aws_lambda_function_url" "ai_solver" {
  function_name      = aws_lambda_function.ai_solver.function_name
  authorization_type = "NONE"
  invoke_mode        = "RESPONSE_STREAM"

  cors {
    allow_origins = ["*"]
    allow_methods = ["*"]
    allow_headers = ["content-type", "authorization"]
    max_age       = 3600
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# OUTPUTS — Function URL'ler (Cloudflare CNAME ve frontend için)
# ═══════════════════════════════════════════════════════════════════════════════
output "site_builder_function_url" {
  value = aws_lambda_function_url.site_builder.function_url
}
output "site_builder_url_domain" {
  value = replace(replace(aws_lambda_function_url.site_builder.function_url, "https://", ""), "/", "")
}
output "ai_solver_function_url" {
  value = aws_lambda_function_url.ai_solver.function_url
}
output "ai_solver_url_domain" {
  value = replace(replace(aws_lambda_function_url.ai_solver.function_url, "https://", ""), "/", "")
}

# ═══════════════════════════════════════════════════════════════════════════════
# KODSUZ AI LAMBDA'LARI — backend kodu yazılınca geri açılacak (YORUM SATIRINDA)
# ═══════════════════════════════════════════════════════════════════════════════
# data "archive_file" "ai_placeholder" {
#   type        = "zip"
#   output_path = "${path.module}/ai_placeholder.zip"
#   source {
#     content  = "placeholder"
#     filename = "bootstrap"
#   }
# }
#
# resource "aws_lambda_function" "chatbot" {
#   function_name    = "${var.name_prefix}-ai-chatbot"
#   role             = aws_iam_role.ai_lambda.arn
#   handler          = "bootstrap"
#   runtime          = "provided.al2023"
#   architectures    = ["arm64"]
#   timeout          = 30
#   memory_size      = 256
#   filename         = data.archive_file.ai_placeholder.output_path
#   source_code_hash = data.archive_file.ai_placeholder.output_base64sha256
#   vpc_config {
#     subnet_ids         = var.private_subnet_ids
#     security_group_ids = [var.lambda_sg_id]
#   }
#   environment {
#     variables = merge(var.lambda_env_common, {
#       FUNCTION_NAME  = "ai-chatbot"
#       GEMINI_API_KEY = var.gemini_api_key
#       GEMINI_MODEL   = var.gemini_model
#     })
#   }
# }
#
# resource "aws_lambda_function" "product_qa" {
#   function_name    = "${var.name_prefix}-ai-product-qa"
#   role             = aws_iam_role.ai_lambda.arn
#   handler          = "bootstrap"
#   runtime          = "provided.al2023"
#   architectures    = ["arm64"]
#   timeout          = 30
#   memory_size      = 256
#   filename         = data.archive_file.ai_placeholder.output_path
#   source_code_hash = data.archive_file.ai_placeholder.output_base64sha256
#   vpc_config {
#     subnet_ids         = var.private_subnet_ids
#     security_group_ids = [var.lambda_sg_id]
#   }
#   environment {
#     variables = merge(var.lambda_env_common, {
#       FUNCTION_NAME  = "ai-product-qa"
#       GEMINI_API_KEY = var.gemini_api_key
#       GEMINI_MODEL   = var.gemini_model
#     })
#   }
# }
#
# resource "aws_lambda_function" "vision" {
#   function_name    = "${var.name_prefix}-ai-vision"
#   role             = aws_iam_role.ai_lambda.arn
#   handler          = "bootstrap"
#   runtime          = "provided.al2023"
#   architectures    = ["arm64"]
#   timeout          = 30
#   memory_size      = 512
#   filename         = data.archive_file.ai_placeholder.output_path
#   source_code_hash = data.archive_file.ai_placeholder.output_base64sha256
#   vpc_config {
#     subnet_ids         = var.private_subnet_ids
#     security_group_ids = [var.lambda_sg_id]
#   }
#   environment {
#     variables = merge(var.lambda_env_common, {
#       FUNCTION_NAME  = "ai-vision"
#       GEMINI_API_KEY = var.gemini_api_key
#       GEMINI_MODEL   = var.gemini_model
#     })
#   }
# }
#
# resource "aws_lambda_function" "recommendation" {
#   function_name    = "${var.name_prefix}-ai-recommendation"
#   role             = aws_iam_role.ai_lambda.arn
#   handler          = "bootstrap"
#   runtime          = "provided.al2023"
#   architectures    = ["arm64"]
#   timeout          = 30
#   memory_size      = 256
#   filename         = data.archive_file.ai_placeholder.output_path
#   source_code_hash = data.archive_file.ai_placeholder.output_base64sha256
#   vpc_config {
#     subnet_ids         = var.private_subnet_ids
#     security_group_ids = [var.lambda_sg_id]
#   }
#   environment {
#     variables = merge(var.lambda_env_common, { FUNCTION_NAME = "ai-recommendation" })
#   }
# }
#
# resource "aws_cloudwatch_event_target" "recommendation_target" {
#   rule           = "${var.name_prefix}-user-interaction"
#   event_bus_name = var.eventbridge_bus_name
#   arn            = aws_lambda_function.recommendation.arn
# }
#
# resource "aws_lambda_permission" "eventbridge_recommendation" {
#   action        = "lambda:InvokeFunction"
#   function_name = aws_lambda_function.recommendation.function_name
#   principal     = "events.amazonaws.com"
#   source_arn    = var.eventbridge_bus_arn
# }
#
# # AI API Gateway route'ları — AI artık Function URL kullanıyor, bunlar kapalı.
# resource "aws_apigatewayv2_integration" "chatbot" {
#   api_id                 = var.api_gateway_id
#   integration_type       = "AWS_PROXY"
#   integration_uri        = aws_lambda_function.chatbot.invoke_arn
#   payload_format_version = "2.0"
# }
# resource "aws_apigatewayv2_integration" "product_qa" {
#   api_id                 = var.api_gateway_id
#   integration_type       = "AWS_PROXY"
#   integration_uri        = aws_lambda_function.product_qa.invoke_arn
#   payload_format_version = "2.0"
# }
# resource "aws_apigatewayv2_integration" "vision" {
#   api_id                 = var.api_gateway_id
#   integration_type       = "AWS_PROXY"
#   integration_uri        = aws_lambda_function.vision.invoke_arn
#   payload_format_version = "2.0"
# }
# resource "aws_apigatewayv2_route" "chatbot" {
#   api_id    = var.api_gateway_id
#   route_key = "POST /api/ai/chat"
#   target    = "integrations/${aws_apigatewayv2_integration.chatbot.id}"
# }
# resource "aws_apigatewayv2_route" "product_qa" {
#   api_id    = var.api_gateway_id
#   route_key = "POST /api/ai/product-qa"
#   target    = "integrations/${aws_apigatewayv2_integration.product_qa.id}"
# }
# resource "aws_apigatewayv2_route" "vision" {
#   api_id    = var.api_gateway_id
#   route_key = "POST /api/ai/vision"
#   target    = "integrations/${aws_apigatewayv2_integration.vision.id}"
# }
# resource "aws_lambda_permission" "apigw_chatbot" {
#   action        = "lambda:InvokeFunction"
#   function_name = aws_lambda_function.chatbot.function_name
#   principal     = "apigateway.amazonaws.com"
#   source_arn    = "${var.api_gateway_execution_arn}/*/*"
# }
# resource "aws_lambda_permission" "apigw_product_qa" {
#   action        = "lambda:InvokeFunction"
#   function_name = aws_lambda_function.product_qa.function_name
#   principal     = "apigateway.amazonaws.com"
#   source_arn    = "${var.api_gateway_execution_arn}/*/*"
# }
# resource "aws_lambda_permission" "apigw_vision" {
#   action        = "lambda:InvokeFunction"
#   function_name = aws_lambda_function.vision.function_name
#   principal     = "apigateway.amazonaws.com"
#   source_arn    = "${var.api_gateway_execution_arn}/*/*"
# }
