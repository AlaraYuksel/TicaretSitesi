# ─── Build Stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Önce sadece package dosyalarını kopyala — bağımlılıkları cache'le
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# Kaynak kodu kopyala
COPY . .

# Production build — VITE_API_URL build-time arg ile geçirilebilir
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ─── Runtime Stage ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Varsayılan nginx config'ini değiştir — SPA routing için gerekli
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Vite build çıktısını nginx'in serve edeceği dizine kopyala
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
