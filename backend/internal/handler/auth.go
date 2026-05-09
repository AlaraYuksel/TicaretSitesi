// 🔄 COGNITO_SWITCH: Bu dosyanın tamamı lokal auth içindir.
// Cognito'ya geçildiğinde bu dosya kaldırılır.
// Cognito modunda register/login Cognito hosted UI veya SDK üzerinden yapılır.
// Backend sadece Cognito JWT token'ı doğrular.

package handler

import (
	"log"
	"net/http"
	"strings"

	"go-backend-projem/internal/db"
	"go-backend-projem/internal/middleware"

	"golang.org/x/crypto/bcrypt"
)

// AuthHandler lokal auth (register/login) işlemlerini yönetir.
type AuthHandler struct {
	store     *db.Store
	jwtSecret string
}

func NewAuthHandler(store *db.Store, jwtSecret string) *AuthHandler {
	return &AuthHandler{store: store, jwtSecret: jwtSecret}
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}

	// Basit validasyon
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		writeError(w, http.StatusBadRequest, "Geçerli bir email giriniz")
		return
	}
	if len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "Parola en az 6 karakter olmalıdır")
		return
	}

	// Bcrypt ile hash'le
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Şifre işlenemedi")
		return
	}

	// Kullanıcı oluştur
	user, err := h.store.CreateUserLocal(r.Context(), req.Email, string(hash))
	if err != nil {
		// Duplicate email hatası kontrol et
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique") {
			writeError(w, http.StatusConflict, "Bu email zaten kayıtlı")
			return
		}
		log.Printf("Register error: %v", err)
		writeError(w, http.StatusInternalServerError, "Kayıt oluşturulamadı")
		return
	}

	// JWT üret
	token, err := middleware.GenerateToken(user.ID, user.Email, h.jwtSecret)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Token üretilemedi")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"token": token,
		"user":  user,
	})
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	// Kullanıcıyı bul
	user, err := h.store.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Email veya şifre hatalı")
		return
	}

	// Şifre doğrula
	if user.PasswordHash == nil {
		writeError(w, http.StatusUnauthorized, "Email veya şifre hatalı")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "Email veya şifre hatalı")
		return
	}

	// JWT üret
	token, err := middleware.GenerateToken(user.ID, user.Email, h.jwtSecret)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Token üretilemedi")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"user":  user,
	})
}

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Token'dan kullanıcı bilgisini döner.

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())

	user, err := h.store.GetUserByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Kullanıcı bulunamadı")
		return
	}

	writeJSON(w, http.StatusOK, user)
}
