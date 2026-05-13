// Ürün Soruları (Q&A) handler'ları.
//
//   • POST   /api/marketplace/products/{id}/questions  (auth)  — buyer soru sorar
//   • GET    /api/marketplace/products/{id}/questions  (public) — cevaplanmış sorular
//   • GET    /api/seller/questions                     (auth)   — sahibinin tüm soruları
//   • POST   /api/seller/questions/{id}/answer         (auth)   — cevapla
//
// Ownership: AnswerQuestion sahibinin site_id'sinin user'a ait olduğunu
// GetQuestionForSeller ile teyit eder.
package handler

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"go-backend-projem/internal/db"
	"go-backend-projem/internal/middleware"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type QuestionsHandler struct {
	store *db.Store
}

func NewQuestionsHandler(store *db.Store) *QuestionsHandler {
	return &QuestionsHandler{store: store}
}

// ─── POST /api/marketplace/products/{id}/questions (auth) ─────────────────

type askQuestionRequest struct {
	Question string `json:"question"`
}

func (h *QuestionsHandler) Ask(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "Soru sormak için giriş yapın")
		return
	}
	productID := pathValue(r, "id")
	if _, err := uuid.Parse(productID); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz ürün ID")
		return
	}

	var req askQuestionRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}
	q := strings.TrimSpace(req.Question)
	if len(q) < 5 {
		writeError(w, http.StatusBadRequest, "Soru en az 5 karakter olmalı")
		return
	}
	if len(q) > 1000 {
		writeError(w, http.StatusBadRequest, "Soru en fazla 1000 karakter olabilir")
		return
	}

	// Soruyu ürünün site_id'sine bağla (satıcıyı buradan buluyoruz).
	siteID, err := h.store.GetPublishedProductSiteID(r.Context(), productID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Ürün bulunamadı")
			return
		}
		log.Printf("GetPublishedProductSiteID: %v", err)
		writeError(w, http.StatusInternalServerError, "Soru kaydedilemedi")
		return
	}

	pq, err := h.store.CreateQuestion(r.Context(), productID, siteID, userID, q)
	if err != nil {
		log.Printf("CreateQuestion: %v", err)
		writeError(w, http.StatusInternalServerError, "Soru kaydedilemedi")
		return
	}
	writeJSON(w, http.StatusCreated, pq)
}

// ─── GET /api/marketplace/products/{id}/questions (public) ────────────────

func (h *QuestionsHandler) PublicList(w http.ResponseWriter, r *http.Request) {
	productID := pathValue(r, "id")
	if _, err := uuid.Parse(productID); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz ürün ID")
		return
	}
	out, err := h.store.ListAnsweredQuestionsByProduct(r.Context(), productID, 20)
	if err != nil {
		log.Printf("ListAnsweredQuestionsByProduct: %v", err)
		writeError(w, http.StatusInternalServerError, "Sorular yüklenemedi")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// ─── GET /api/seller/questions?status=pending|answered (auth) ─────────────

func (h *QuestionsHandler) SellerList(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	status := r.URL.Query().Get("status")

	// count_only=1 → sadece bekleyen sayısı (sidebar badge için)
	if r.URL.Query().Get("count_only") == "1" {
		n, err := h.store.CountPendingQuestionsBySeller(r.Context(), userID)
		if err != nil {
			log.Printf("CountPendingQuestionsBySeller: %v", err)
			writeError(w, http.StatusInternalServerError, "Sorular sayılamadı")
			return
		}
		writeJSON(w, http.StatusOK, map[string]int{"count": n})
		return
	}

	out, err := h.store.ListQuestionsBySeller(r.Context(), userID, status)
	if err != nil {
		log.Printf("ListQuestionsBySeller: %v", err)
		writeError(w, http.StatusInternalServerError, "Sorular yüklenemedi")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// ─── POST /api/seller/questions/{id}/answer (auth) ────────────────────────

type answerRequest struct {
	Answer string `json:"answer"`
}

func (h *QuestionsHandler) Answer(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	id := pathValue(r, "id")
	if _, err := uuid.Parse(id); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz soru ID")
		return
	}
	var req answerRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}
	ans := strings.TrimSpace(req.Answer)
	if len(ans) < 2 {
		writeError(w, http.StatusBadRequest, "Cevap çok kısa")
		return
	}
	if len(ans) > 2000 {
		writeError(w, http.StatusBadRequest, "Cevap en fazla 2000 karakter olabilir")
		return
	}

	// Ownership doğrulaması — site_id user'a ait olmalı.
	if _, err := h.store.GetQuestionForSeller(r.Context(), id, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusForbidden, "Bu soruya erişiminiz yok")
			return
		}
		log.Printf("GetQuestionForSeller: %v", err)
		writeError(w, http.StatusInternalServerError, "Soru yüklenemedi")
		return
	}

	pq, err := h.store.AnswerQuestion(r.Context(), id, ans)
	if err != nil {
		log.Printf("AnswerQuestion: %v", err)
		writeError(w, http.StatusInternalServerError, "Cevap kaydedilemedi")
		return
	}
	writeJSON(w, http.StatusOK, pq)
}
