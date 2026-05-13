// Ürün Soruları (Q&A) store metotları.
//
// Public Q&A modeli (Trendyol/Hepsiburada tarzı): yalnızca cevaplanmış sorular
// ürün sayfasında herkese görünür. Bekleyen sorular sadece satıcının
// dashboard'unda + soru sahibinin geçmişinde gösterilir.
package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

type ProductQuestion struct {
	ID          string     `json:"id"`
	ProductID   string     `json:"product_id"`
	BuyerID     string     `json:"buyer_id"`
	SiteID      string     `json:"site_id"`
	Question    string     `json:"question"`
	Answer      *string    `json:"answer,omitempty"`
	IsAnswered  bool       `json:"is_answered"`
	CreatedAt   time.Time  `json:"created_at"`
	AnsweredAt  *time.Time `json:"answered_at,omitempty"`

	// JOIN ile gelen ek alanlar (opsiyonel)
	BuyerName    *string `json:"buyer_name,omitempty"`
	ProductTitle *string `json:"product_title,omitempty"`
}

// CreateQuestion — buyer yeni soru sorduğunda. site_id ürünün site_id'sinden alınır
// (handler tarafında published_products'tan lookup yapılır).
func (s *Store) CreateQuestion(ctx context.Context, productID, siteID, buyerID, question string) (*ProductQuestion, error) {
	const q = `
		INSERT INTO product_questions (product_id, buyer_id, site_id, question)
		VALUES ($1, $2, $3, $4)
		RETURNING id, product_id, buyer_id, site_id, question, answer, is_answered, created_at, answered_at`
	row := s.pool.QueryRow(ctx, q, productID, buyerID, siteID, question)
	var pq ProductQuestion
	err := row.Scan(
		&pq.ID, &pq.ProductID, &pq.BuyerID, &pq.SiteID,
		&pq.Question, &pq.Answer, &pq.IsAnswered,
		&pq.CreatedAt, &pq.AnsweredAt,
	)
	if err != nil {
		return nil, fmt.Errorf("CreateQuestion: %w", err)
	}
	return &pq, nil
}

// AnswerQuestion — satıcı kendi ürününün sorusunu cevaplar. Ownership kontrolü:
// q'nun site_id'sinin user'a ait olduğu sites tablosundan doğrulanmalı.
// Bu fonksiyon yalnızca sahipliği daha önce doğrulanmışsa çağırılmalıdır
// (handler tarafında JOIN ile teyit edilir).
func (s *Store) AnswerQuestion(ctx context.Context, id, answer string) (*ProductQuestion, error) {
	const q = `
		UPDATE product_questions
		SET answer = $2,
		    is_answered = TRUE,
		    answered_at = NOW()
		WHERE id = $1
		RETURNING id, product_id, buyer_id, site_id, question, answer, is_answered, created_at, answered_at`
	row := s.pool.QueryRow(ctx, q, id, answer)
	var pq ProductQuestion
	err := row.Scan(
		&pq.ID, &pq.ProductID, &pq.BuyerID, &pq.SiteID,
		&pq.Question, &pq.Answer, &pq.IsAnswered,
		&pq.CreatedAt, &pq.AnsweredAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pgx.ErrNoRows
		}
		return nil, fmt.Errorf("AnswerQuestion: %w", err)
	}
	return &pq, nil
}

// GetQuestionForSeller — ownership doğrulamalı detay. Satıcının kendi
// site_id'sine ait olmayan soruyu kullanıcıya göstermez.
func (s *Store) GetQuestionForSeller(ctx context.Context, questionID, sellerUserID string) (*ProductQuestion, error) {
	const q = `
		SELECT pq.id, pq.product_id, pq.buyer_id, pq.site_id,
		       pq.question, pq.answer, pq.is_answered, pq.created_at, pq.answered_at
		FROM product_questions pq
		INNER JOIN sites s ON s.id = pq.site_id
		WHERE pq.id = $1 AND s.user_id = $2`
	row := s.pool.QueryRow(ctx, q, questionID, sellerUserID)
	var pq ProductQuestion
	err := row.Scan(
		&pq.ID, &pq.ProductID, &pq.BuyerID, &pq.SiteID,
		&pq.Question, &pq.Answer, &pq.IsAnswered,
		&pq.CreatedAt, &pq.AnsweredAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pgx.ErrNoRows
		}
		return nil, fmt.Errorf("GetQuestionForSeller: %w", err)
	}
	return &pq, nil
}

// ListAnsweredQuestionsByProduct — public ürün sayfası için cevaplanmış sorular.
func (s *Store) ListAnsweredQuestionsByProduct(ctx context.Context, productID string, limit int) ([]ProductQuestion, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	const q = `
		SELECT pq.id, pq.product_id, pq.buyer_id, pq.site_id,
		       pq.question, pq.answer, pq.is_answered, pq.created_at, pq.answered_at,
		       u.full_name
		FROM product_questions pq
		LEFT JOIN users u ON u.id = pq.buyer_id
		WHERE pq.product_id = $1 AND pq.is_answered = TRUE
		ORDER BY pq.answered_at DESC NULLS LAST
		LIMIT $2`
	rows, err := s.pool.Query(ctx, q, productID, limit)
	if err != nil {
		return nil, fmt.Errorf("ListAnsweredQuestionsByProduct: %w", err)
	}
	defer rows.Close()

	out := []ProductQuestion{}
	for rows.Next() {
		var pq ProductQuestion
		if err := rows.Scan(
			&pq.ID, &pq.ProductID, &pq.BuyerID, &pq.SiteID,
			&pq.Question, &pq.Answer, &pq.IsAnswered,
			&pq.CreatedAt, &pq.AnsweredAt,
			&pq.BuyerName,
		); err != nil {
			return nil, err
		}
		// Privacy: BuyerID'yi public response'ta sızdırma
		pq.BuyerID = ""
		out = append(out, pq)
	}
	return out, rows.Err()
}

// ListQuestionsBySeller — Satıcının tüm site'larındaki sorular. status="pending"
// olursa yalnızca cevaplanmamış, "answered" olursa cevaplananlar, boş ise hepsi.
func (s *Store) ListQuestionsBySeller(ctx context.Context, sellerUserID, status string) ([]ProductQuestion, error) {
	var (
		baseQuery = `
			SELECT pq.id, pq.product_id, pq.buyer_id, pq.site_id,
			       pq.question, pq.answer, pq.is_answered, pq.created_at, pq.answered_at,
			       u.full_name, pp.title
			FROM product_questions pq
			INNER JOIN sites s ON s.id = pq.site_id
			LEFT  JOIN users u ON u.id = pq.buyer_id
			LEFT  JOIN published_products pp ON pp.id = pq.product_id
			WHERE s.user_id = $1`
		args = []any{sellerUserID}
	)
	switch status {
	case "pending":
		baseQuery += " AND pq.is_answered = FALSE"
	case "answered":
		baseQuery += " AND pq.is_answered = TRUE"
	}
	baseQuery += " ORDER BY pq.is_answered ASC, pq.created_at DESC LIMIT 200"

	rows, err := s.pool.Query(ctx, baseQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("ListQuestionsBySeller: %w", err)
	}
	defer rows.Close()

	out := []ProductQuestion{}
	for rows.Next() {
		var pq ProductQuestion
		if err := rows.Scan(
			&pq.ID, &pq.ProductID, &pq.BuyerID, &pq.SiteID,
			&pq.Question, &pq.Answer, &pq.IsAnswered,
			&pq.CreatedAt, &pq.AnsweredAt,
			&pq.BuyerName, &pq.ProductTitle,
		); err != nil {
			return nil, err
		}
		out = append(out, pq)
	}
	return out, rows.Err()
}

// CountPendingQuestionsBySeller — sidebar badge için.
func (s *Store) CountPendingQuestionsBySeller(ctx context.Context, sellerUserID string) (int, error) {
	const q = `
		SELECT COUNT(*)
		FROM product_questions pq
		INNER JOIN sites s ON s.id = pq.site_id
		WHERE s.user_id = $1 AND pq.is_answered = FALSE`
	var n int
	err := s.pool.QueryRow(ctx, q, sellerUserID).Scan(&n)
	return n, err
}

// GetPublishedProductSiteID — soru oluşturulurken ürünün site_id'sini bulmak için.
// (UUID validation handler tarafında yapılır.)
func (s *Store) GetPublishedProductSiteID(ctx context.Context, productID string) (string, error) {
	var siteID string
	err := s.pool.QueryRow(ctx, `SELECT site_id FROM published_products WHERE id = $1`, productID).Scan(&siteID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", pgx.ErrNoRows
		}
		return "", fmt.Errorf("GetPublishedProductSiteID: %w", err)
	}
	return siteID, nil
}
