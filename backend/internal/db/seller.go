// Satıcı (seller_profiles) store metotları. Stripe Connect onboarding ve
// account.updated webhook'unun güncellediği alanları (stripe_account_id,
// stripe_onboarded, payout_enabled) yönetir.
package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

type SellerProfile struct {
	ID                string     `json:"id"`
	UserID            string     `json:"user_id"`
	StoreName         string     `json:"store_name"`
	StoreSlug         *string    `json:"store_slug,omitempty"`
	StripeAccountID   *string    `json:"stripe_account_id,omitempty"`
	StripeOnboarded   bool       `json:"stripe_onboarded"`
	PayoutEnabled     bool       `json:"payout_enabled"`
	IsActive          bool       `json:"is_active"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

func (s *Store) GetSellerProfileByUserID(ctx context.Context, userID string) (*SellerProfile, error) {
	const q = `
		SELECT id, user_id, store_name, store_slug,
		       stripe_account_id, COALESCE(stripe_onboarded, FALSE),
		       COALESCE(payout_enabled, FALSE), COALESCE(is_active, TRUE),
		       created_at, updated_at
		FROM seller_profiles
		WHERE user_id = $1`
	row := s.pool.QueryRow(ctx, q, userID)
	var sp SellerProfile
	err := row.Scan(
		&sp.ID, &sp.UserID, &sp.StoreName, &sp.StoreSlug,
		&sp.StripeAccountID, &sp.StripeOnboarded, &sp.PayoutEnabled, &sp.IsActive,
		&sp.CreatedAt, &sp.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pgx.ErrNoRows
		}
		return nil, fmt.Errorf("GetSellerProfileByUserID: %w", err)
	}
	return &sp, nil
}

// EnsureSellerProfile — yoksa minimal bir kayıt oluşturur. store_slug, kullanıcı
// e-postasından/UUID'sinden türetilebilir; çakışırsa caller yeniden çağırır.
func (s *Store) EnsureSellerProfile(ctx context.Context, userID, storeName, storeSlug string) (*SellerProfile, error) {
	if sp, err := s.GetSellerProfileByUserID(ctx, userID); err == nil {
		return sp, nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	const q = `
		INSERT INTO seller_profiles (user_id, store_name, store_slug)
		VALUES ($1, $2, NULLIF($3,''))
		RETURNING id, user_id, store_name, store_slug,
		          stripe_account_id, COALESCE(stripe_onboarded, FALSE),
		          COALESCE(payout_enabled, FALSE), COALESCE(is_active, TRUE),
		          created_at, updated_at`
	row := s.pool.QueryRow(ctx, q, userID, storeName, storeSlug)
	var sp SellerProfile
	if err := row.Scan(
		&sp.ID, &sp.UserID, &sp.StoreName, &sp.StoreSlug,
		&sp.StripeAccountID, &sp.StripeOnboarded, &sp.PayoutEnabled, &sp.IsActive,
		&sp.CreatedAt, &sp.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("EnsureSellerProfile: %w", err)
	}
	return &sp, nil
}

// SetSellerStripeAccount — onboarding başlangıcında acct_xxx kaydeder.
func (s *Store) SetSellerStripeAccount(ctx context.Context, sellerID, accountID string) error {
	const q = `
		UPDATE seller_profiles
		SET stripe_account_id = $2,
		    stripe_onboarded  = FALSE,
		    payout_enabled    = FALSE,
		    updated_at        = NOW()
		WHERE id = $1`
	tag, err := s.pool.Exec(ctx, q, sellerID, accountID)
	if err != nil {
		return fmt.Errorf("SetSellerStripeAccount: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// UpdateSellerStripeStatus — account.updated webhook tarafından çağrılır.
func (s *Store) UpdateSellerStripeStatus(ctx context.Context, accountID string, onboarded, payoutEnabled bool) error {
	const q = `
		UPDATE seller_profiles
		SET stripe_onboarded = $2,
		    payout_enabled   = $3,
		    updated_at       = NOW()
		WHERE stripe_account_id = $1`
	_, err := s.pool.Exec(ctx, q, accountID, onboarded, payoutEnabled)
	if err != nil {
		return fmt.Errorf("UpdateSellerStripeStatus: %w", err)
	}
	return nil
}
