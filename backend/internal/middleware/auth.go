// 🔄 COGNITO_SWITCH: Bu dosyanın tamamı lokal JWT auth içindir.
// Cognito'ya geçildiğinde:
//   1. JWTAuth fonksiyonunu CognitoAuth ile değiştirin
//   2. keyfunc/v3 ile JWKS tabanlı doğrulamaya geçin
//   3. Claims'den "sub" ve "email" okuyun
// Eski Cognito kodu git geçmişinde mevcuttur.

package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// contextKey tip çakışmalarını önlemek için özel tip kullanılır.
type contextKey string

const (
	// UserIDKey — JWT'den gelen user ID. Handler'larda r.Context().Value(middleware.UserIDKey) ile alınır.
	UserIDKey contextKey = "user_id"
	// UserEmailKey — JWT'den gelen email.
	UserEmailKey contextKey = "user_email"
)

// 🔄 COGNITO_SWITCH: GenerateToken — Lokal auth için JWT üretir.
// Cognito modunda bu fonksiyon kullanılmaz, token Cognito'dan gelir.
func GenerateToken(userID, email, secret string) (string, error) {
	claims := jwt.MapClaims{
		"sub":   userID,
		"email": email,
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(7 * 24 * time.Hour).Unix(), // 7 gün
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// 🔄 COGNITO_SWITCH: JWTAuth — HMAC-SHA256 ile JWT doğrulayan middleware.
// Cognito'ya geçildiğinde bu fonksiyon yerine CognitoAuth (JWKS tabanlı) kullanılır.
func JWTAuth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				jsonError(w, "Authorization header eksik", http.StatusUnauthorized)
				return
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

			token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
				// HMAC signing method kontrolü
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(jwtSecret), nil
			})
			if err != nil || !token.Valid {
				jsonError(w, "Geçersiz token", http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				jsonError(w, "Token claims okunamadı", http.StatusUnauthorized)
				return
			}

			sub, _ := claims["sub"].(string)
			email, _ := claims["email"].(string)

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

func UserEmailFromCtx(ctx context.Context) string {
	email, _ := ctx.Value(UserEmailKey).(string)
	return email
}

func jsonError(w http.ResponseWriter, msg string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write([]byte(`{"error":"` + msg + `"}`))
}
