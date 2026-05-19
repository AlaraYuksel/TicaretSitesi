# ═══════════════════════════════════════════════════════════════════════════════
# Terraform Çıktıları — Deploy sonrası önemli bilgiler
# ═══════════════════════════════════════════════════════════════════════════════

output "cloudflare_nameservers" {
  description = "Registrar'da bu nameserver'lara geçin (iluvcode.art)"
  value       = one(cloudflare_zone.main[*].name_servers)
}

output "cloudflare_zone_id" {
  description = "Cloudflare Zone ID"
  value       = one(cloudflare_zone.main[*].id)
}

output "api_gateway_url" {
  description = "API Gateway invoke URL"
  value       = module.compute.api_gateway_invoke_url
}

output "domain_router_url" {
  description = "Published Sites Lambda Function URL"
  value       = module.compute.domain_router_function_url
}

output "ai_site_builder_url" {
  description = "AI Site Builder Lambda Function URL (ham)"
  value       = module.ai.site_builder_function_url
}

output "ai_solver_url" {
  description = "AI Solver Lambda Function URL (ham)"
  value       = module.ai.ai_solver_function_url
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
    ║     MARKETPLACE + AI — DEPLOYMENT ÖZETİ (Cloudflare)       ║
    ╠══════════════════════════════════════════════════════════════╣
    ║                                                              ║
    ║  Platform URL   : https://${var.domain_name}                 ║
    ║  Published Sites: https://*.${var.domain_name}               ║
    ║  API Gateway    : ${module.compute.api_gateway_invoke_url}   ║
    ║                                                              ║
    ║  ⚡ Cloudflare Nameservers:                                  ║
    ║  ${join("\n    ║  ", var.enable_edge ? cloudflare_zone.main[0].name_servers : ["(edge devre disi)"])}                ║
    ║                                                              ║
    ║  S3 React       : ${module.data.s3_react_bucket}             ║
    ║  S3 Assets      : ${module.data.s3_assets_bucket}            ║
    ║  S3 Published   : ${module.data.s3_published_bucket}         ║
    ║                                                              ║
    ║  SQS Finance    : ✅ aktif                                   ║
    ║  SQS Publish    : ✅ aktif                                   ║
    ║  SQS Notif      : ✅ aktif                                   ║
    ║  EventBridge    : ✅ aktif                                    ║
    ║  DynamoDB       : ✅ aktif                                    ║
    ║                                                              ║
    ║  📋 YAPILACAK: Registrar'da nameserver'ları güncelleyin      ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
  EOT
}
