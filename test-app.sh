#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# TEK KOMUTLA UYGULAMA TESTİ — Codespaces'te (AWS gerekmez)
#
#   bash test-app.sh
#
# Yaptıkları:
#   1. PostgreSQL (pgvector) konteynerini başlatır
#   2. Veritabanını sıfırlar + 6 migration'ı uygular
#   3. Go backend'i çalıştırır       → http://localhost:8080
#   4. React frontend'i çalıştırır   → http://localhost:5173
#
# Durdurmak için: Ctrl+C  (her iki sunucu da kapanır)
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"

PG_CONTAINER="ticaret-postgres"
DB_NAME="ticaret"

# ─── 1. PostgreSQL ───────────────────────────────────────────────────────────
echo "▶ [1/5] PostgreSQL (pgvector) başlatılıyor..."
docker compose -f .devcontainer/postgres-compose.yml up -d

echo "▶ [2/5] Veritabanının hazır olması bekleniyor..."
until docker exec "$PG_CONTAINER" pg_isready -U postgres -q 2>/dev/null; do sleep 2; done
echo "    ✓ veritabanı hazır"

# ─── 2. Migration'lar ────────────────────────────────────────────────────────
echo "▶ [3/5] Veritabanı sıfırlanıyor + migration'lar uygulanıyor..."
docker exec -i "$PG_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS $DB_NAME;" -c "CREATE DATABASE $DB_NAME;" >/dev/null
for f in backend/db/migrations/*.sql; do
  echo "    → $(basename "$f")"
  docker exec -i "$PG_CONTAINER" psql -U postgres -d "$DB_NAME" -v ON_ERROR_STOP=1 -q < "$f"
done
echo "    ✓ migration'lar uygulandı"

# ─── Ortam değişkenleri ──────────────────────────────────────────────────────
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/${DB_NAME}?sslmode=disable"
export PORT="8080"
export JWT_SECRET="local-dev-jwt-secret-min-32-characters-long"
export FRONTEND_BASE_URL="http://localhost:5173"
export PLATFORM_FEE_PERCENT="5"

# ─── 3. Backend ──────────────────────────────────────────────────────────────
echo "▶ [4/5] Backend (Go) başlatılıyor → http://localhost:8080"
( cd backend && go run . ) &
BACKEND_PID=$!

cleanup() {
  echo ""
  echo "▶ Kapatılıyor..."
  kill "$BACKEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ─── 4. Frontend ─────────────────────────────────────────────────────────────
echo "▶ [5/5] Frontend bağımlılıkları + Vite başlatılıyor → http://localhost:5173"
cd frontend
# --legacy-peer-deps: eslint surum cakismasini atlar (lint araci, uygulamayi etkilemez)
[ -d node_modules ] || npm install --legacy-peer-deps
npm run dev -- --host
