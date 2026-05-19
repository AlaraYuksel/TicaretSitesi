# ═══════════════════════════════════════════════════════════════════════════════
# Frontend (React/Vite build) → S3 react bucket
# ═══════════════════════════════════════════════════════════════════════════════
#
# frontend/dist (npm run build çıktısı) terraform ile S3'e yüklenir.
# Her dosya bir aws_s3_object kaynağı → terraform destroy hepsini temiz siler.
#
# ÖNKOŞUL: terraform apply'dan önce `cd frontend; npm run build` çalıştırılmış,
# frontend/dist klasörü mevcut olmalı. (destroy'dan ÖNCE de dist silinmemeli.)
# ═══════════════════════════════════════════════════════════════════════════════

locals {
  frontend_dist = "${path.root}/../frontend/dist"

  frontend_mime = {
    html        = "text/html; charset=utf-8"
    js          = "application/javascript; charset=utf-8"
    mjs         = "application/javascript; charset=utf-8"
    css         = "text/css; charset=utf-8"
    json        = "application/json"
    map         = "application/json"
    svg         = "image/svg+xml"
    png         = "image/png"
    jpg         = "image/jpeg"
    jpeg        = "image/jpeg"
    gif         = "image/gif"
    webp        = "image/webp"
    avif        = "image/avif"
    ico         = "image/x-icon"
    woff        = "font/woff"
    woff2       = "font/woff2"
    ttf         = "font/ttf"
    txt         = "text/plain; charset=utf-8"
    xml         = "application/xml"
    webmanifest = "application/manifest+json"
  }
}

resource "aws_s3_object" "frontend" {
  for_each = fileset(local.frontend_dist, "**")

  bucket = aws_s3_bucket.react.id
  key    = each.value
  source = "${local.frontend_dist}/${each.value}"
  etag   = filemd5("${local.frontend_dist}/${each.value}")

  content_type = lookup(
    local.frontend_mime,
    lower(try(element(regexall("[^.]+$", each.value), 0), "")),
    "application/octet-stream"
  )
}
