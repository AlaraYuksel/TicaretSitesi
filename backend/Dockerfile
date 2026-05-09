# ─── Build Stage ──────────────────────────────────────────────────────────────
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Önce sadece go.mod ve go.sum kopyala — bağımlılıkları cache'le
COPY go.mod go.sum ./
RUN go mod download

# Kaynak kodu kopyala ve derle
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server .

# ─── Runtime Stage ────────────────────────────────────────────────────────────
FROM alpine:3.21

# SSL sertifikaları (HTTPS çağrıları için) ve timezone
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=builder /app/server .

EXPOSE 8080

# Graceful shutdown için exec form kullan
CMD ["./server"]
