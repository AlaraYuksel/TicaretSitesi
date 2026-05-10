# ═══════════════════════════════════════════════════════════════════════════════
# Terraform Çıktıları — Deploy sonrası önemli bilgiler
# ═══════════════════════════════════════════════════════════════════════════════

output "cloudfront_domain" {
  description = "Platform CloudFront dağıtım domain'i"
  value       = module.edge.cloudfront_domain
}

output "cloudfront_published_domain" {
  description = "Yayınlanan satıcı siteleri CloudFront domain'i"
  value       = module.edge.cloudfront_published_domain
}

output "api_gateway_url" {
  description = "API Gateway invoke URL"
  value       = module.compute.api_gateway_invoke_url
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = module.data.rds_endpoint
  sensitive   = true
}

output "s3_react_bucket" {
  description = "React build dosyalarının yükleneceği S3 bucket"
  value       = module.data.s3_react_bucket
}

output "s3_assets_bucket" {
  description = "Ürün görselleri için S3 bucket"
  value       = module.data.s3_assets_bucket
}

output "s3_published_bucket" {
  description = "Yayınlanan sitelerin S3 bucket'ı"
  value       = module.data.s3_published_bucket
}

output "sqs_finance_queue_url" {
  description = "Finance SQS kuyruk URL'i"
  value       = module.async.sqs_finance_queue_url
}

output "sqs_publish_queue_url" {
  description = "Publish SQS kuyruk URL'i"
  value       = module.async.sqs_publish_queue_url
}

output "dynamodb_table_name" {
  description = "DynamoDB tablo adı"
  value       = module.data.dynamodb_table_name
}

output "deployment_summary" {
  description = "Deploy özeti"
  value       = <<-EOT
    
    ╔══════════════════════════════════════════════════════════════╗
    ║           MARKETPLACE + AI — DEPLOYMENT ÖZETİ               ║
    ╠══════════════════════════════════════════════════════════════╣
    ║                                                              ║
    ║  Platform URL  : https://${var.domain_name}                  ║
    ║  API Gateway   : ${module.compute.api_gateway_invoke_url}    ║
    ║  CDN (Platform): ${module.edge.cloudfront_domain}            ║
    ║  CDN (Sites)   : ${module.edge.cloudfront_published_domain}  ║
    ║                                                              ║
    ║  RDS Endpoint  : (sensitive — terraform output rds_endpoint) ║
    ║  S3 React      : ${module.data.s3_react_bucket}              ║
    ║  S3 Assets     : ${module.data.s3_assets_bucket}             ║
    ║  S3 Published  : ${module.data.s3_published_bucket}          ║
    ║                                                              ║
    ║  SQS Finance   : ✅ aktif                                   ║
    ║  SQS Publish   : ✅ aktif                                   ║
    ║  SQS Notif     : ✅ aktif                                   ║
    ║  EventBridge   : ✅ aktif                                   ║
    ║  DynamoDB      : ✅ aktif                                   ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
  EOT
}
