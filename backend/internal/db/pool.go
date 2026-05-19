package db

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPool pgx connection pool açar ve sağlık kontrolü yapar.
// Docker Compose'da DB hazır olmadan önce API başlarsa healthcheck döngüsü bekler.
func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("db config parse hatası: %w", err)
	}

	// Pool ayarları.
	// Docker'da tek süreç çalışır → geniş pool (20) uygundur.
	// Lambda'da ise her eşzamanlı çağrı kendi pool'unu açar; RDS max_connections
	// (~100) hızla dolabilir. Bu yüzden Lambda entrypoint'leri DB_MAX_CONNS=4 gibi
	// düşük bir değer geçer (lambdart.Load bunu set eder).
	cfg.MaxConns = 20
	cfg.MinConns = 2
	if v := os.Getenv("DB_MAX_CONNS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.MaxConns = int32(n)
			if cfg.MinConns > cfg.MaxConns {
				cfg.MinConns = cfg.MaxConns
			}
		}
	}
	cfg.MaxConnLifetime = 1 * time.Hour
	cfg.MaxConnIdleTime = 30 * time.Minute
	cfg.HealthCheckPeriod = 1 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("pool oluşturma hatası: %w", err)
	}

	// Bağlantıyı test et
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("db ping hatası: %w", err)
	}

	return pool, nil
}
