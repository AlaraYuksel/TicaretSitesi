// Marketplace alıcısının adres defteri + ödeme yöntemleri için store metotları.
// PCI not: payment_methods sadece Stripe tokenı (pm_*) + display verisi tutar.
package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// ─── Tipler ──────────────────────────────────────────────────────────────────

type Address struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	Label         *string   `json:"label,omitempty"`
	RecipientName string    `json:"recipient_name"`
	Phone         string    `json:"phone"`
	Line1         string    `json:"line1"`
	Line2         *string   `json:"line2,omitempty"`
	City          string    `json:"city"`
	State         *string   `json:"state,omitempty"`
	Zip           *string   `json:"zip,omitempty"`
	Country       string    `json:"country"`
	IsDefault     bool      `json:"is_default"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type PaymentMethod struct {
	ID                    string    `json:"id"`
	UserID                string    `json:"-"` // frontend'e sızdırma
	StripePaymentMethodID string    `json:"stripe_payment_method_id"`
	Brand                 string    `json:"brand"`
	Last4                 string    `json:"last4"`
	ExpMonth              int16     `json:"exp_month"`
	ExpYear               int16     `json:"exp_year"`
	IsDefault             bool      `json:"is_default"`
	CreatedAt             time.Time `json:"created_at"`
}

// ─── Addresses ──────────────────────────────────────────────────────────────

func (s *Store) ListAddresses(ctx context.Context, userID string) ([]Address, error) {
	const q = `
		SELECT id, user_id, label, recipient_name, phone,
		       line1, line2, city, state, zip, country,
		       is_default, created_at, updated_at
		FROM addresses
		WHERE user_id = $1
		ORDER BY is_default DESC, created_at DESC`

	rows, err := s.pool.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("ListAddresses: %w", err)
	}
	defer rows.Close()

	out := []Address{}
	for rows.Next() {
		var a Address
		if err := rows.Scan(
			&a.ID, &a.UserID, &a.Label, &a.RecipientName, &a.Phone,
			&a.Line1, &a.Line2, &a.City, &a.State, &a.Zip, &a.Country,
			&a.IsDefault, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *Store) GetAddress(ctx context.Context, id, userID string) (*Address, error) {
	const q = `
		SELECT id, user_id, label, recipient_name, phone,
		       line1, line2, city, state, zip, country,
		       is_default, created_at, updated_at
		FROM addresses
		WHERE id = $1 AND user_id = $2`

	row := s.pool.QueryRow(ctx, q, id, userID)
	var a Address
	err := row.Scan(
		&a.ID, &a.UserID, &a.Label, &a.RecipientName, &a.Phone,
		&a.Line1, &a.Line2, &a.City, &a.State, &a.Zip, &a.Country,
		&a.IsDefault, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pgx.ErrNoRows
		}
		return nil, fmt.Errorf("GetAddress: %w", err)
	}
	return &a, nil
}

// CreateAddress — isDefault=true ise diğer adresleri TRANSACTION içinde non-default yapar.
func (s *Store) CreateAddress(ctx context.Context, a *Address) (*Address, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if a.IsDefault {
		if _, err := tx.Exec(ctx, `UPDATE addresses SET is_default = FALSE WHERE user_id = $1`, a.UserID); err != nil {
			return nil, fmt.Errorf("clear default: %w", err)
		}
	}

	const q = `
		INSERT INTO addresses (user_id, label, recipient_name, phone, line1, line2, city, state, zip, country, is_default)
		VALUES ($1, NULLIF($2,''), $3, $4, $5, NULLIF($6,''), $7, NULLIF($8,''), NULLIF($9,''), COALESCE(NULLIF($10,''),'TR'), $11)
		RETURNING id, user_id, label, recipient_name, phone, line1, line2, city, state, zip, country, is_default, created_at, updated_at`

	row := tx.QueryRow(ctx, q,
		a.UserID,
		valueOrEmpty(a.Label), a.RecipientName, a.Phone,
		a.Line1, valueOrEmpty(a.Line2),
		a.City, valueOrEmpty(a.State), valueOrEmpty(a.Zip),
		a.Country, a.IsDefault,
	)
	var out Address
	if err := row.Scan(
		&out.ID, &out.UserID, &out.Label, &out.RecipientName, &out.Phone,
		&out.Line1, &out.Line2, &out.City, &out.State, &out.Zip, &out.Country,
		&out.IsDefault, &out.CreatedAt, &out.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("CreateAddress: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) UpdateAddress(ctx context.Context, a *Address) (*Address, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if a.IsDefault {
		if _, err := tx.Exec(ctx, `UPDATE addresses SET is_default = FALSE WHERE user_id = $1 AND id <> $2`, a.UserID, a.ID); err != nil {
			return nil, fmt.Errorf("clear default: %w", err)
		}
	}

	const q = `
		UPDATE addresses SET
			label          = NULLIF($3,''),
			recipient_name = $4,
			phone          = $5,
			line1          = $6,
			line2          = NULLIF($7,''),
			city           = $8,
			state          = NULLIF($9,''),
			zip            = NULLIF($10,''),
			country        = COALESCE(NULLIF($11,''),'TR'),
			is_default     = $12,
			updated_at     = NOW()
		WHERE id = $1 AND user_id = $2
		RETURNING id, user_id, label, recipient_name, phone, line1, line2, city, state, zip, country, is_default, created_at, updated_at`

	row := tx.QueryRow(ctx, q,
		a.ID, a.UserID,
		valueOrEmpty(a.Label), a.RecipientName, a.Phone,
		a.Line1, valueOrEmpty(a.Line2),
		a.City, valueOrEmpty(a.State), valueOrEmpty(a.Zip),
		a.Country, a.IsDefault,
	)
	var out Address
	if err := row.Scan(
		&out.ID, &out.UserID, &out.Label, &out.RecipientName, &out.Phone,
		&out.Line1, &out.Line2, &out.City, &out.State, &out.Zip, &out.Country,
		&out.IsDefault, &out.CreatedAt, &out.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pgx.ErrNoRows
		}
		return nil, fmt.Errorf("UpdateAddress: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) DeleteAddress(ctx context.Context, id, userID string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM addresses WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return fmt.Errorf("DeleteAddress: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Store) SetDefaultAddress(ctx context.Context, id, userID string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE addresses SET is_default = FALSE WHERE user_id = $1`, userID); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `UPDATE addresses SET is_default = TRUE WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return tx.Commit(ctx)
}

// ─── Payment Methods ────────────────────────────────────────────────────────

func (s *Store) ListPaymentMethods(ctx context.Context, userID string) ([]PaymentMethod, error) {
	const q = `
		SELECT id, user_id, stripe_payment_method_id, brand, last4,
		       exp_month, exp_year, is_default, created_at
		FROM payment_methods
		WHERE user_id = $1
		ORDER BY is_default DESC, created_at DESC`

	rows, err := s.pool.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("ListPaymentMethods: %w", err)
	}
	defer rows.Close()

	out := []PaymentMethod{}
	for rows.Next() {
		var pm PaymentMethod
		if err := rows.Scan(
			&pm.ID, &pm.UserID, &pm.StripePaymentMethodID, &pm.Brand, &pm.Last4,
			&pm.ExpMonth, &pm.ExpYear, &pm.IsDefault, &pm.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, pm)
	}
	return out, rows.Err()
}

func (s *Store) GetPaymentMethod(ctx context.Context, id, userID string) (*PaymentMethod, error) {
	const q = `
		SELECT id, user_id, stripe_payment_method_id, brand, last4,
		       exp_month, exp_year, is_default, created_at
		FROM payment_methods
		WHERE id = $1 AND user_id = $2`
	row := s.pool.QueryRow(ctx, q, id, userID)
	var pm PaymentMethod
	err := row.Scan(
		&pm.ID, &pm.UserID, &pm.StripePaymentMethodID, &pm.Brand, &pm.Last4,
		&pm.ExpMonth, &pm.ExpYear, &pm.IsDefault, &pm.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pgx.ErrNoRows
		}
		return nil, fmt.Errorf("GetPaymentMethod: %w", err)
	}
	return &pm, nil
}

// CreatePaymentMethod — kullanıcının kart eklediğinde Stripe attach + display verisi yazımı.
// İlk kart otomatik default olur.
func (s *Store) CreatePaymentMethod(ctx context.Context, pm *PaymentMethod) (*PaymentMethod, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Mevcut kart sayısı 0 ise yeni kart default
	var count int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM payment_methods WHERE user_id = $1`, pm.UserID).Scan(&count); err != nil {
		return nil, err
	}
	if count == 0 {
		pm.IsDefault = true
	} else if pm.IsDefault {
		if _, err := tx.Exec(ctx, `UPDATE payment_methods SET is_default = FALSE WHERE user_id = $1`, pm.UserID); err != nil {
			return nil, err
		}
	}

	const q = `
		INSERT INTO payment_methods (user_id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, user_id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default, created_at`

	row := tx.QueryRow(ctx, q,
		pm.UserID, pm.StripePaymentMethodID, pm.Brand, pm.Last4,
		pm.ExpMonth, pm.ExpYear, pm.IsDefault,
	)
	var out PaymentMethod
	if err := row.Scan(
		&out.ID, &out.UserID, &out.StripePaymentMethodID, &out.Brand, &out.Last4,
		&out.ExpMonth, &out.ExpYear, &out.IsDefault, &out.CreatedAt,
	); err != nil {
		return nil, fmt.Errorf("CreatePaymentMethod: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) DeletePaymentMethod(ctx context.Context, id, userID string) (*PaymentMethod, error) {
	const q = `
		DELETE FROM payment_methods
		WHERE id = $1 AND user_id = $2
		RETURNING id, user_id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default, created_at`
	row := s.pool.QueryRow(ctx, q, id, userID)
	var pm PaymentMethod
	err := row.Scan(
		&pm.ID, &pm.UserID, &pm.StripePaymentMethodID, &pm.Brand, &pm.Last4,
		&pm.ExpMonth, &pm.ExpYear, &pm.IsDefault, &pm.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pgx.ErrNoRows
		}
		return nil, fmt.Errorf("DeletePaymentMethod: %w", err)
	}
	return &pm, nil
}

func (s *Store) SetDefaultPaymentMethod(ctx context.Context, id, userID string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE payment_methods SET is_default = FALSE WHERE user_id = $1`, userID); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `UPDATE payment_methods SET is_default = TRUE WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return tx.Commit(ctx)
}

// ─── Yardımcılar ────────────────────────────────────────────────────────────

func valueOrEmpty(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
