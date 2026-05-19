# ═══════════════════════════════════════════════════════════════════════════════
# COMPUTE — Lambda Fonksiyonları
# Her Lambda kendi gerçek zip'ini kullanır (backend/build/lambda/<name>/<name>.zip)
# ═══════════════════════════════════════════════════════════════════════════════

# ── Auth λ ───────────────────────────────────────────────────────────────────
resource "aws_lambda_function" "auth" {
  function_name    = "${var.name_prefix}-auth"
  role             = local.common_lambda.role
  handler          = local.common_lambda.handler
  runtime          = local.common_lambda.runtime
  architectures    = local.common_lambda.architectures
  timeout          = 10
  memory_size      = 128
  filename         = local.lambda_zip["auth"]
  source_code_hash = filebase64sha256(local.lambda_zip["auth"])
  vpc_config {
    subnet_ids         = local.common_lambda.subnets
    security_group_ids = local.common_lambda.sg
  }
  environment { variables = merge(var.lambda_env_common, { FUNCTION_NAME = "auth" }) }
}

# ── Sites λ ──────────────────────────────────────────────────────────────────
# timeout 120s: publish, sitedeki her ürün için Gemini embedding üretir —
# 15s yetmiyordu (publish 500 hatasının sebebiydi).
resource "aws_lambda_function" "sites" {
  function_name    = "${var.name_prefix}-sites"
  role             = local.common_lambda.role
  handler          = local.common_lambda.handler
  runtime          = local.common_lambda.runtime
  architectures    = local.common_lambda.architectures
  timeout          = 120
  memory_size      = 256
  filename         = local.lambda_zip["sites"]
  source_code_hash = filebase64sha256(local.lambda_zip["sites"])
  vpc_config {
    subnet_ids         = local.common_lambda.subnets
    security_group_ids = local.common_lambda.sg
  }
  environment {
    variables = merge(var.lambda_env_common, {
      FUNCTION_NAME       = "sites"
      SQS_PUBLISH_URL     = var.sqs_publish_queue_url
      S3_PUBLISHED_BUCKET = var.s3_published_bucket
    })
  }
}

# ── Products λ ───────────────────────────────────────────────────────────────
resource "aws_lambda_function" "products" {
  function_name    = "${var.name_prefix}-products"
  role             = local.common_lambda.role
  handler          = local.common_lambda.handler
  runtime          = local.common_lambda.runtime
  architectures    = local.common_lambda.architectures
  timeout          = 15
  memory_size      = 256
  filename         = local.lambda_zip["products"]
  source_code_hash = filebase64sha256(local.lambda_zip["products"])
  vpc_config {
    subnet_ids         = local.common_lambda.subnets
    security_group_ids = local.common_lambda.sg
  }
  environment {
    variables = merge(var.lambda_env_common, {
      FUNCTION_NAME    = "products"
      S3_ASSETS_BUCKET = var.s3_assets_bucket
    })
  }
}

# ── Orders λ ─────────────────────────────────────────────────────────────────
resource "aws_lambda_function" "orders" {
  function_name    = "${var.name_prefix}-orders"
  role             = local.common_lambda.role
  handler          = local.common_lambda.handler
  runtime          = local.common_lambda.runtime
  architectures    = local.common_lambda.architectures
  timeout          = 15
  memory_size      = 256
  filename         = local.lambda_zip["orders"]
  source_code_hash = filebase64sha256(local.lambda_zip["orders"])
  vpc_config {
    subnet_ids         = local.common_lambda.subnets
    security_group_ids = local.common_lambda.sg
  }
  environment {
    variables = merge(var.lambda_env_common, {
      FUNCTION_NAME         = "orders"
      STRIPE_SECRET_KEY     = var.stripe_secret_key
      SQS_NOTIFICATIONS_URL = var.sqs_notifications_queue_url
    })
  }
}

# ── Seller λ ─────────────────────────────────────────────────────────────────
resource "aws_lambda_function" "seller" {
  function_name    = "${var.name_prefix}-seller"
  role             = local.common_lambda.role
  handler          = local.common_lambda.handler
  runtime          = local.common_lambda.runtime
  architectures    = local.common_lambda.architectures
  timeout          = 15
  memory_size      = 256
  filename         = local.lambda_zip["seller"]
  source_code_hash = filebase64sha256(local.lambda_zip["seller"])
  vpc_config {
    subnet_ids         = local.common_lambda.subnets
    security_group_ids = local.common_lambda.sg
  }
  environment {
    variables = merge(var.lambda_env_common, {
      FUNCTION_NAME            = "seller"
      STRIPE_SECRET_KEY        = var.stripe_secret_key
      STRIPE_CONNECT_CLIENT_ID = var.stripe_connect_client_id
      EASYPOST_API_KEY         = var.easypost_api_key
    })
  }
}

# ── Buyer λ ──────────────────────────────────────────────────────────────────
resource "aws_lambda_function" "buyer" {
  function_name    = "${var.name_prefix}-buyer"
  role             = local.common_lambda.role
  handler          = local.common_lambda.handler
  runtime          = local.common_lambda.runtime
  architectures    = local.common_lambda.architectures
  timeout          = 15
  memory_size      = 256
  filename         = local.lambda_zip["buyer"]
  source_code_hash = filebase64sha256(local.lambda_zip["buyer"])
  vpc_config {
    subnet_ids         = local.common_lambda.subnets
    security_group_ids = local.common_lambda.sg
  }
  environment {
    variables = merge(var.lambda_env_common, {
      FUNCTION_NAME     = "buyer"
      STRIPE_SECRET_KEY = var.stripe_secret_key
    })
  }
}

# ── Webhooks λ ───────────────────────────────────────────────────────────────
resource "aws_lambda_function" "webhooks" {
  function_name    = "${var.name_prefix}-webhooks"
  role             = local.common_lambda.role
  handler          = local.common_lambda.handler
  runtime          = local.common_lambda.runtime
  architectures    = local.common_lambda.architectures
  timeout          = 10
  memory_size      = 128
  filename         = local.lambda_zip["webhooks"]
  source_code_hash = filebase64sha256(local.lambda_zip["webhooks"])
  vpc_config {
    subnet_ids         = local.common_lambda.subnets
    security_group_ids = local.common_lambda.sg
  }
  environment {
    variables = merge(var.lambda_env_common, {
      FUNCTION_NAME           = "webhooks"
      STRIPE_SECRET_KEY       = var.stripe_secret_key
      STRIPE_WEBHOOK_SECRET   = var.stripe_webhook_secret
      EASYPOST_WEBHOOK_SECRET = var.easypost_webhook_secret
      SQS_FINANCE_URL         = var.sqs_finance_queue_url
      SQS_NOTIFICATIONS_URL   = var.sqs_notifications_queue_url
    })
  }
}

# ── Publisher λ (SQS consumer — publish kuyruğu) ─────────────────────────────
resource "aws_lambda_function" "publisher" {
  function_name    = "${var.name_prefix}-publisher"
  role             = local.common_lambda.role
  handler          = local.common_lambda.handler
  runtime          = local.common_lambda.runtime
  architectures    = local.common_lambda.architectures
  timeout          = 300
  memory_size      = 512
  filename         = local.lambda_zip["publisher"]
  source_code_hash = filebase64sha256(local.lambda_zip["publisher"])
  vpc_config {
    subnet_ids         = local.common_lambda.subnets
    security_group_ids = local.common_lambda.sg
  }
  environment {
    variables = merge(var.lambda_env_common, {
      FUNCTION_NAME       = "publisher"
      S3_PUBLISHED_BUCKET = var.s3_published_bucket
    })
  }
}

# ── Finance Worker λ (SQS consumer — finance kuyruğu) ────────────────────────
resource "aws_lambda_function" "finance_worker" {
  function_name    = "${var.name_prefix}-finance-worker"
  role             = local.common_lambda.role
  handler          = local.common_lambda.handler
  runtime          = local.common_lambda.runtime
  architectures    = local.common_lambda.architectures
  timeout          = 60
  memory_size      = 256
  filename         = local.lambda_zip["finance-worker"]
  source_code_hash = filebase64sha256(local.lambda_zip["finance-worker"])
  vpc_config {
    subnet_ids         = local.common_lambda.subnets
    security_group_ids = local.common_lambda.sg
  }
  environment {
    variables = merge(var.lambda_env_common, {
      FUNCTION_NAME     = "finance-worker"
      STRIPE_SECRET_KEY = var.stripe_secret_key
    })
  }
}

# ── Migrate λ (RDS şema kurulumu — terraform tarafından bir kez invoke edilir) ─
resource "aws_lambda_function" "migrate" {
  function_name    = "${var.name_prefix}-migrate"
  role             = local.common_lambda.role
  handler          = local.common_lambda.handler
  runtime          = local.common_lambda.runtime
  architectures    = local.common_lambda.architectures
  timeout          = 120
  memory_size      = 256
  filename         = local.lambda_zip["migrate"]
  source_code_hash = filebase64sha256(local.lambda_zip["migrate"])
  vpc_config {
    subnet_ids         = local.common_lambda.subnets
    security_group_ids = local.common_lambda.sg
  }
  environment { variables = merge(var.lambda_env_common, { FUNCTION_NAME = "migrate" }) }
}

# RDS hazır olduktan sonra migration'ları bir kez çalıştır.
# Migrate kodu değişince (zip hash) tekrar çalışır; migration'lar idempotent.
resource "aws_lambda_invocation" "migrate" {
  function_name = aws_lambda_function.migrate.function_name
  input         = jsonencode({ trigger = "terraform-apply" })

  triggers = {
    code = aws_lambda_function.migrate.source_code_hash
  }

  # Log grubu invocation'dan önce oluşmalı — yoksa Lambda kendi oluşturur ve
  # terraform'un aws_cloudwatch_log_group kaydıyla çakışır.
  depends_on = [aws_cloudwatch_log_group.lambda]
}

# ── SQS → Lambda Event Source Mapping ────────────────────────────────────────
resource "aws_lambda_event_source_mapping" "finance_to_worker" {
  event_source_arn = var.sqs_finance_queue_arn
  function_name    = aws_lambda_function.finance_worker.arn
  batch_size       = 1
  enabled          = true
}

resource "aws_lambda_event_source_mapping" "publish_to_publisher" {
  event_source_arn = var.sqs_publish_queue_arn
  function_name    = aws_lambda_function.publisher.arn
  batch_size       = 1
  enabled          = true
}

# ── Domain Router λ ─────────────────────────────────────────────────────────
# *.iluvcode.art isteklerini karşılar — Host header'dan subdomain parse eder,
# S3 Published Sites bucket'ından ilgili sitenin dosyalarını döndürür.
resource "aws_lambda_function" "domain_router" {
  function_name    = "${var.name_prefix}-domain-router"
  role             = local.common_lambda.role
  handler          = local.common_lambda.handler
  runtime          = local.common_lambda.runtime
  architectures    = local.common_lambda.architectures
  timeout          = 10
  memory_size      = 128
  filename         = local.lambda_zip["domain-router"]
  source_code_hash = filebase64sha256(local.lambda_zip["domain-router"])
  # VPC gerekmez — sadece S3'e erişir (public endpoint)
  environment {
    variables = {
      FUNCTION_NAME       = "domain-router"
      S3_PUBLISHED_BUCKET = var.s3_published_bucket
      DOMAIN_NAME         = var.domain_name
      ENVIRONMENT         = lookup(var.lambda_env_common, "ENVIRONMENT", "dev")
    }
  }
}

# Lambda Function URL — CloudFront yerine doğrudan erişim noktası
resource "aws_lambda_function_url" "domain_router" {
  function_name      = aws_lambda_function.domain_router.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = ["*"]
    allow_methods = ["GET", "HEAD"]
    max_age       = 3600
  }
}

# authorization_type=NONE tek başına yetmez — Function URL'in herkese açık
# çağrılabilmesi için lambda:InvokeFunctionUrl izni de gerekir (Console bunu
# otomatik ekler, terraform'da elle eklenmeli). Yoksa 403 Forbidden döner.
resource "aws_lambda_permission" "domain_router_url" {
  statement_id           = "AllowPublicFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.domain_router.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# ── Static Serve λ ──────────────────────────────────────────────────────────
# iluvcode.art isteklerini karşılar — React SPA dosyalarını S3'ten serve eder.
# API Gateway $default route'undan tetiklenir.
resource "aws_lambda_function" "static_serve" {
  function_name    = "${var.name_prefix}-static-serve"
  role             = local.common_lambda.role
  handler          = local.common_lambda.handler
  runtime          = local.common_lambda.runtime
  architectures    = local.common_lambda.architectures
  timeout          = 10
  memory_size      = 256
  filename         = local.lambda_zip["static-serve"]
  source_code_hash = filebase64sha256(local.lambda_zip["static-serve"])
  # VPC gerekmez — sadece S3'e erişir
  environment {
    variables = {
      FUNCTION_NAME    = "static-serve"
      S3_REACT_BUCKET  = var.s3_react_bucket
      S3_ASSETS_BUCKET = var.s3_assets_bucket
      ENVIRONMENT      = lookup(var.lambda_env_common, "ENVIRONMENT", "dev")
    }
  }
}
