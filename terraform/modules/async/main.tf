# ═══════════════════════════════════════════════════════════════════════════════
# ASYNC MODÜLÜ — SQS Kuyrukları + EventBridge
# Mimari Diyagram: "Async / Event Katmanı"
# ═══════════════════════════════════════════════════════════════════════════════

variable "name_prefix" { type = string }

# ═══════════════════════════════════════════════════════════════════════════════
# 1. SQS — Finance Queue
# EasyPost webhook → Stripe escrow release
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_sqs_queue" "finance_dlq" {
  name                      = "${var.name_prefix}-finance-dlq"
  message_retention_seconds = 1209600  # 14 gün — DLQ uzun tutulur
  tags                      = { Name = "${var.name_prefix}-finance-dlq" }
}

resource "aws_sqs_queue" "finance" {
  name                       = "${var.name_prefix}-finance"
  visibility_timeout_seconds = 60       # İşlenirken başka worker alamaz
  message_retention_seconds  = 345600   # 4 gün
  receive_wait_time_seconds  = 20       # Long polling — maliyet düşürür

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.finance_dlq.arn
    maxReceiveCount     = 3  # 3 başarısız → DLQ'ya düş
  })

  tags = { Name = "${var.name_prefix}-finance" }
}

# ═══════════════════════════════════════════════════════════════════════════════
# 2. SQS — Publish Queue
# Site yayınlama işleri (HTML render, S3 write, CF invalidate)
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_sqs_queue" "publish_dlq" {
  name                      = "${var.name_prefix}-publish-dlq"
  message_retention_seconds = 1209600
  tags                      = { Name = "${var.name_prefix}-publish-dlq" }
}

resource "aws_sqs_queue" "publish" {
  name                       = "${var.name_prefix}-publish"
  visibility_timeout_seconds = 300  # Render işlemi 5 dakikaya kadar sürebilir
  message_retention_seconds  = 86400
  receive_wait_time_seconds  = 20

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.publish_dlq.arn
    maxReceiveCount     = 3
  })

  tags = { Name = "${var.name_prefix}-publish" }
}

# ═══════════════════════════════════════════════════════════════════════════════
# 3. SQS — Notifications Queue
# E-posta, SMS, sipariş bildirimleri → SES
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_sqs_queue" "notifications_dlq" {
  name                      = "${var.name_prefix}-notifications-dlq"
  message_retention_seconds = 1209600
  tags                      = { Name = "${var.name_prefix}-notifications-dlq" }
}

resource "aws_sqs_queue" "notifications" {
  name                       = "${var.name_prefix}-notifications"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400
  receive_wait_time_seconds  = 20

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notifications_dlq.arn
    maxReceiveCount     = 3
  })

  tags = { Name = "${var.name_prefix}-notifications" }
}

# ═══════════════════════════════════════════════════════════════════════════════
# 4. EventBridge — Kullanıcı etkileşim eventleri
# Tıklama, sipariş, ürün görüntüleme → Öneri sistemi
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_cloudwatch_event_bus" "marketplace" {
  name = "${var.name_prefix}-events"
  tags = { Name = "${var.name_prefix}-event-bus" }
}

# ── Öneri Lambda'yı tetikleyen kural ─────────────────────────────────────────
resource "aws_cloudwatch_event_rule" "user_interaction" {
  name           = "${var.name_prefix}-user-interaction"
  description    = "Ürün tıklama ve sipariş eventleri → Öneri Lambda"
  event_bus_name = aws_cloudwatch_event_bus.marketplace.name

  event_pattern = jsonencode({
    source      = ["marketplace.products", "marketplace.orders"]
    detail-type = ["ProductViewed", "ProductClicked", "OrderPlaced"]
  })

  tags = { Name = "${var.name_prefix}-interaction-rule" }
}

# ═══════════════════════════════════════════════════════════════════════════════
# OUTPUTS
# ═══════════════════════════════════════════════════════════════════════════════

output "sqs_finance_queue_arn" {
  value = aws_sqs_queue.finance.arn
}

output "sqs_finance_queue_url" {
  value = aws_sqs_queue.finance.url
}

output "sqs_publish_queue_arn" {
  value = aws_sqs_queue.publish.arn
}

output "sqs_publish_queue_url" {
  value = aws_sqs_queue.publish.url
}

output "sqs_notifications_queue_arn" {
  value = aws_sqs_queue.notifications.arn
}

output "sqs_notifications_queue_url" {
  value = aws_sqs_queue.notifications.url
}

output "eventbridge_bus_arn" {
  value = aws_cloudwatch_event_bus.marketplace.arn
}

output "eventbridge_bus_name" {
  value = aws_cloudwatch_event_bus.marketplace.name
}

output "eventbridge_interaction_rule_arn" {
  value = aws_cloudwatch_event_rule.user_interaction.arn
}
