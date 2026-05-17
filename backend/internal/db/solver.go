package db

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// EmbedText — ürünün anlamsal arama için embedlenecek metnini üretir.
// Başlık + kategori + rozet + açıklama birleştirilir.
func (pp PublishedProduct) EmbedText() string {
	parts := []string{pp.Title}
	if pp.Category != nil && strings.TrimSpace(*pp.Category) != "" {
		parts = append(parts, "Kategori: "+*pp.Category)
	}
	if pp.Badge != nil && strings.TrimSpace(*pp.Badge) != "" {
		parts = append(parts, *pp.Badge)
	}
	if pp.Description != nil && strings.TrimSpace(*pp.Description) != "" {
		parts = append(parts, *pp.Description)
	}
	return strings.Join(parts, ". ")
}

// ─── AI Solver — Embedding & Vektörel Arama ────────────────────────────────────
//
// Embedding'ler pgvector'ün `vector` tipinde saklanır. pgx'e ek sürücü tipi
// eklemeden, []float32 değeri "[0.1,0.2,...]" metin literaline çevrilip
// sorguda `$n::vector` ile cast edilir.

// publishedProductColumns — scanPublishedProduct ile birebir aynı sırada olmalı.
const publishedProductColumns = `
	pp.id, pp.site_id, pp.user_id, pp.source_element_id, pp.source_type,
	pp.title, pp.slug, pp.description, pp.price, pp.compare_price, pp.currency,
	pp.image_url, pp.images, pp.category, pp.badge, pp.rating, pp.review_count,
	pp.stock_quantity, pp.store_name, pp.created_at, pp.updated_at`

// vectorLiteral — []float32'yi pgvector metin literaline çevirir: "[0.1,0.2,...]".
func vectorLiteral(emb []float32) string {
	var b strings.Builder
	b.WriteByte('[')
	for i, v := range emb {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(strconv.FormatFloat(float64(v), 'f', -1, 32))
	}
	b.WriteByte(']')
	return b.String()
}

// UpdatePublishedProductEmbedding — bir ürünün anlamsal arama vektörünü yazar.
func (s *Store) UpdatePublishedProductEmbedding(ctx context.Context, productID string, emb []float32) error {
	const q = `
		UPDATE published_products
		SET embedding = $2::vector, embedded_at = NOW()
		WHERE id = $1`
	_, err := s.pool.Exec(ctx, q, productID, vectorLiteral(emb))
	if err != nil {
		return fmt.Errorf("UpdatePublishedProductEmbedding: %w", err)
	}
	return nil
}

// SearchPublishedProductsByVector — embedding'e kosinüs benzerliği ile en yakın
// ürünleri getirir. Yalnızca yayınlanmış sitelerin embedding'i olan ürünleri.
func (s *Store) SearchPublishedProductsByVector(ctx context.Context, emb []float32, limit int) ([]PublishedProduct, error) {
	if limit <= 0 || limit > 50 {
		limit = 12
	}
	q := `
		SELECT ` + publishedProductColumns + `
		FROM published_products pp
		JOIN sites s ON s.id = pp.site_id AND s.is_published = TRUE
		WHERE pp.embedding IS NOT NULL
		ORDER BY pp.embedding <=> $1::vector
		LIMIT $2`

	rows, err := s.pool.Query(ctx, q, vectorLiteral(emb), limit)
	if err != nil {
		return nil, fmt.Errorf("SearchPublishedProductsByVector: %w", err)
	}
	defer rows.Close()

	var out []PublishedProduct
	for rows.Next() {
		pp, err := scanPublishedProduct(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *pp)
	}
	return out, rows.Err()
}

// ListPublishedProductsWithoutEmbedding — backfill için: embedding'i olmayanlar.
func (s *Store) ListPublishedProductsWithoutEmbedding(ctx context.Context, limit int) ([]PublishedProduct, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	q := `
		SELECT ` + publishedProductColumns + `
		FROM published_products pp
		WHERE pp.embedding IS NULL
		ORDER BY pp.created_at
		LIMIT $1`

	rows, err := s.pool.Query(ctx, q, limit)
	if err != nil {
		return nil, fmt.Errorf("ListPublishedProductsWithoutEmbedding: %w", err)
	}
	defer rows.Close()

	var out []PublishedProduct
	for rows.Next() {
		pp, err := scanPublishedProduct(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *pp)
	}
	return out, rows.Err()
}

// ─── AI Solutions — kullanıcıya özel kaydedilmiş çözümler ─────────────────────

type AISolution struct {
	ID          string          `json:"id"`
	UserID      string          `json:"user_id"`
	ProblemText string          `json:"problem_text"`
	Analysis    json.RawMessage `json:"analysis"`
	Package     json.RawMessage `json:"package"`
	CreatedAt   time.Time       `json:"created_at"`
}

// CreateAISolution — bir AI çözüm paketini kullanıcının hesabına kaydeder.
func (s *Store) CreateAISolution(ctx context.Context, userID, problemText string, analysis, pkg json.RawMessage) (*AISolution, error) {
	const q = `
		INSERT INTO ai_solutions (user_id, problem_text, analysis, package)
		VALUES ($1, $2, $3, $4)
		RETURNING id, user_id, problem_text, analysis, package, created_at`
	row := s.pool.QueryRow(ctx, q, userID, problemText, analysis, pkg)
	var sol AISolution
	if err := row.Scan(&sol.ID, &sol.UserID, &sol.ProblemText, &sol.Analysis, &sol.Package, &sol.CreatedAt); err != nil {
		return nil, fmt.Errorf("CreateAISolution: %w", err)
	}
	return &sol, nil
}

// ListAISolutionsByUser — kullanıcının kaydettiği tüm çözümler (en yeni önce).
func (s *Store) ListAISolutionsByUser(ctx context.Context, userID string) ([]AISolution, error) {
	const q = `
		SELECT id, user_id, problem_text, analysis, package, created_at
		FROM ai_solutions
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 100`
	rows, err := s.pool.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("ListAISolutionsByUser: %w", err)
	}
	defer rows.Close()

	out := []AISolution{}
	for rows.Next() {
		var sol AISolution
		if err := rows.Scan(&sol.ID, &sol.UserID, &sol.ProblemText, &sol.Analysis, &sol.Package, &sol.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, sol)
	}
	return out, rows.Err()
}

// GetAISolution — tek çözüm; ownership kontrolü user_id ile zorunlu.
func (s *Store) GetAISolution(ctx context.Context, id, userID string) (*AISolution, error) {
	const q = `
		SELECT id, user_id, problem_text, analysis, package, created_at
		FROM ai_solutions
		WHERE id = $1 AND user_id = $2`
	row := s.pool.QueryRow(ctx, q, id, userID)
	var sol AISolution
	if err := row.Scan(&sol.ID, &sol.UserID, &sol.ProblemText, &sol.Analysis, &sol.Package, &sol.CreatedAt); err != nil {
		return nil, err
	}
	return &sol, nil
}
