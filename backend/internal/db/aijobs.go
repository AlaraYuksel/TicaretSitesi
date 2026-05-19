package db

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// AIJob — asenkron bir AI işi (plan / execute / solve).
type AIJob struct {
	ID        string          `json:"id"`
	UserID    string          `json:"user_id"`
	Kind      string          `json:"kind"`
	Status    string          `json:"status"` // pending | running | done | error
	Params    json.RawMessage `json:"params"`
	Events    json.RawMessage `json:"events"`
	Result    json.RawMessage `json:"result,omitempty"`
	Error     *string         `json:"error,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

const aiJobCols = `id, user_id, kind, status, params, events, result, error, created_at, updated_at`

func scanAIJob(row interface {
	Scan(dest ...any) error
}) (*AIJob, error) {
	var j AIJob
	if err := row.Scan(&j.ID, &j.UserID, &j.Kind, &j.Status, &j.Params,
		&j.Events, &j.Result, &j.Error, &j.CreatedAt, &j.UpdatedAt); err != nil {
		return nil, err
	}
	return &j, nil
}

// CreateAIJob yeni bir iş kaydı oluşturur (status=pending).
func (s *Store) CreateAIJob(ctx context.Context, userID, kind string, params json.RawMessage) (*AIJob, error) {
	if len(params) == 0 {
		params = json.RawMessage("{}")
	}
	q := `INSERT INTO ai_jobs (user_id, kind, params) VALUES ($1, $2, $3)
	      RETURNING ` + aiJobCols
	return scanAIJob(s.pool.QueryRow(ctx, q, userID, kind, params))
}

// GetAIJob işi kullanıcıya scope'lu döndürür (status endpoint'i için).
func (s *Store) GetAIJob(ctx context.Context, id, userID string) (*AIJob, error) {
	q := `SELECT ` + aiJobCols + ` FROM ai_jobs WHERE id = $1 AND user_id = $2`
	return scanAIJob(s.pool.QueryRow(ctx, q, id, userID))
}

// GetAIJobByID işi user scope'u olmadan döndürür (worker için).
func (s *Store) GetAIJobByID(ctx context.Context, id string) (*AIJob, error) {
	q := `SELECT ` + aiJobCols + ` FROM ai_jobs WHERE id = $1`
	return scanAIJob(s.pool.QueryRow(ctx, q, id))
}

// SetAIJobRunning işi 'running' durumuna alır.
func (s *Store) SetAIJobRunning(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE ai_jobs SET status='running', updated_at=now() WHERE id=$1`, id)
	return err
}

// AppendAIJobEvent events dizisine bir ilerleme olayı ekler.
func (s *Store) AppendAIJobEvent(ctx context.Context, id string, event json.RawMessage) error {
	// events || [event] — tek elemanlı diziyle birleştir
	wrapped := append(append(json.RawMessage("["), event...), ']')
	_, err := s.pool.Exec(ctx,
		`UPDATE ai_jobs SET events = events || $2::jsonb, updated_at=now() WHERE id=$1`,
		id, wrapped)
	return err
}

// FinishAIJob işi sonlandırır (status=done veya error).
func (s *Store) FinishAIJob(ctx context.Context, id, status string, result json.RawMessage, errMsg string) error {
	if status != "done" && status != "error" {
		return fmt.Errorf("geçersiz iş durumu: %s", status)
	}
	var errPtr *string
	if errMsg != "" {
		errPtr = &errMsg
	}
	_, err := s.pool.Exec(ctx,
		`UPDATE ai_jobs SET status=$2, result=$3, error=$4, updated_at=now() WHERE id=$1`,
		id, status, result, errPtr)
	return err
}
