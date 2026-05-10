# ═══════════════════════════════════════════════════════════════════════════════
# COMPUTE — Lambda Fonksiyonları
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
  filename         = local.common_lambda.filename
  source_code_hash = local.common_lambda.hash
  vpc_config { subnet_ids = local.common_lambda.subnets; security_group_ids = local.common_lambda.sg }
  environment { variables = merge(var.lambda_env_common, { FUNCTION_NAME = "auth" }) }
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
  filename         = local.common_lambda.filename
  source_code_hash = local.common_lambda.hash
  vpc_config { subnet_ids = local.common_lambda.subnets; security_group_ids = local.common_lambda.sg }
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
  filename         = local.common_lambda.filename
  source_code_hash = local.common_lambda.hash
  vpc_config { subnet_ids = local.common_lambda.subnets; security_group_ids = local.common_lambda.sg }
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
  filename         = local.common_lambda.filename
  source_code_hash = local.common_lambda.hash
  vpc_config { subnet_ids = local.common_lambda.subnets; security_group_ids = local.common_lambda.sg }
  environment {
    variables = merge(var.lambda_env_common, {
      FUNCTION_NAME            = "seller"
      STRIPE_SECRET_KEY        = var.stripe_secret_key
      STRIPE_CONNECT_CLIENT_ID = var.stripe_connect_client_id
      EASYPOST_API_KEY         = var.easypost_api_key
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
  filename         = local.common_lambda.filename
  source_code_hash = local.common_lambda.hash
  vpc_config { subnet_ids = local.common_lambda.subnets; security_group_ids = local.common_lambda.sg }
  environment {
    variables = merge(var.lambda_env_common, {
      FUNCTION_NAME           = "webhooks"
      STRIPE_WEBHOOK_SECRET   = var.stripe_webhook_secret
      EASYPOST_WEBHOOK_SECRET = var.easypost_webhook_secret
      SQS_FINANCE_URL         = var.sqs_finance_queue_url
      SQS_NOTIFICATIONS_URL   = var.sqs_notifications_queue_url
    })
  }
}

# ── Publisher λ ──────────────────────────────────────────────────────────────
resource "aws_lambda_function" "publisher" {
  function_name    = "${var.name_prefix}-publisher"
  role             = local.common_lambda.role
  handler          = local.common_lambda.handler
  runtime          = local.common_lambda.runtime
  architectures    = local.common_lambda.architectures
  timeout          = 300
  memory_size      = 512
  filename         = local.common_lambda.filename
  source_code_hash = local.common_lambda.hash
  vpc_config { subnet_ids = local.common_lambda.subnets; security_group_ids = local.common_lambda.sg }
  environment {
    variables = merge(var.lambda_env_common, {
      FUNCTION_NAME       = "publisher"
      S3_PUBLISHED_BUCKET = var.s3_published_bucket
    })
  }
}

# ── Finance Worker λ ─────────────────────────────────────────────────────────
resource "aws_lambda_function" "finance_worker" {
  function_name    = "${var.name_prefix}-finance-worker"
  role             = local.common_lambda.role
  handler          = local.common_lambda.handler
  runtime          = local.common_lambda.runtime
  architectures    = local.common_lambda.architectures
  timeout          = 60
  memory_size      = 256
  filename         = local.common_lambda.filename
  source_code_hash = local.common_lambda.hash
  vpc_config { subnet_ids = local.common_lambda.subnets; security_group_ids = local.common_lambda.sg }
  environment {
    variables = merge(var.lambda_env_common, {
      FUNCTION_NAME     = "finance-worker"
      STRIPE_SECRET_KEY = var.stripe_secret_key
    })
  }
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
