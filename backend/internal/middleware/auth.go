package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

// contextKey tip çakışmalarını önlemek için özel tip kullanılır.
type contextKey string

const (
	// UserIDKey — Cognito sub claim değeri. Handler'larda r.Context().Value(middleware.UserIDKey) ile alınır.
	UserIDKey contextKey = "user_id"
	// UserEmailKey — Cognito email claim'i.
	UserEmailKey contextKey = "user_email"
)

// CognitoAuth Cognito JWKS URL'sini kullanarak JWT doğrulayan middleware üretir.
// jwksURL boşsa (Cognito henüz kurulmadıysa) middleware bypass moduna geçer —
// bu sayede lokal geliştirme Cognito olmadan çalışabilir.
func CognitoAuth(jwksURL string) func(http.Handler) http.Handler {
	// jwksURL boşsa → geliştirme modu, auth bypass
	if jwksURL == "" {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Lokal test için sabit bir user ID inject et (UUID formatında olmalı)
				ctx := context.WithValue(r.Context(), UserIDKey, "00000000-0000-0000-0000-000000000000")
				ctx = context.WithValue(ctx, UserEmailKey, "dev@local.com")
				next.ServeHTTP(w, r.WithContext(ctx))
			})
		}
	}

	// Cognito JWKS'ten public key'leri indir ve otomatik yenile
	kf, err := keyfunc.NewDefaultCtx(context.Background(), []string{jwksURL})
	if err != nil {
		// JWKS indirilemezse uygulama başlamaz — erken hata daha iyidir
		panic("Cognito JWKS başlatılamadı: " + err.Error())
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				jsonError(w, "Authorization header eksik", http.StatusUnauthorized)
				return
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

			token, err := jwt.Parse(tokenStr, kf.Keyfunc)
			if err != nil || !token.Valid {
				jsonError(w, "Geçersiz token", http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				jsonError(w, "Token claims okunamadı", http.StatusUnauthorized)
				return
			}

			// Cognito JWT standart claim'leri
			sub, _ := claims["sub"].(string)          // kullanıcı ID'si
			email, _ := claims["email"].(string)       // email

			ctx := context.WithValue(r.Context(), UserIDKey, sub)
			ctx = context.WithValue(ctx, UserEmailKey, email)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserIDFromCtx context'ten user ID'yi çeker. Handler'larda kullanım kolaylığı sağlar.
func UserIDFromCtx(ctx context.Context) string {
	id, _ := ctx.Value(UserIDKey).(string)
	return id
}

func jsonError(w http.ResponseWriter, msg string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write([]byte(`{"error":"` + msg + `"}`))
}
