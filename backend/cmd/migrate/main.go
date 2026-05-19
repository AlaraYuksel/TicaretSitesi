// migrate Lambda — RDS PostgreSQL şemasını kurar/günceller.
//
// db/migrations/*.sql dosyaları binary'ye gömülüdür (dbmigrations.FS).
// Her dosya bir kez uygulanır; uygulananlar schema_migrations tablosunda izlenir
// (idempotent). Terraform, RDS oluştuktan sonra bu Lambda'yı bir kez invoke eder.
//
// Lokalde de çalıştırılabilir: `go run ./cmd/migrate` (AWS runtime'ı yoksa).
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"

	dbmigrations "go-backend-projem/db"
	"go-backend-projem/internal/config"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/jackc/pgx/v5"
)

func runMigrations(ctx context.Context) (string, error) {
	cfg, err := config.Load()
	if err != nil {
		return "", err
	}

	// Migration dosyaları çok-cümleli SQL içerir → simple protocol gerekir.
	connCfg, err := pgx.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return "", fmt.Errorf("DSN parse: %w", err)
	}
	connCfg.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	conn, err := pgx.ConnectConfig(ctx, connCfg)
	if err != nil {
		return "", fmt.Errorf("DB bağlantısı: %w", err)
	}
	defer conn.Close(ctx)

	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version    TEXT PRIMARY KEY,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
	)`); err != nil {
		return "", fmt.Errorf("schema_migrations oluşturulamadı: %w", err)
	}

	entries, err := dbmigrations.FS.ReadDir("migrations")
	if err != nil {
		return "", fmt.Errorf("gömülü migration'lar okunamadı: %w", err)
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	var report strings.Builder
	applied := 0
	for _, name := range files {
		var exists bool
		if err := conn.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=$1)`, name,
		).Scan(&exists); err != nil {
			return "", err
		}
		if exists {
			report.WriteString("  atlandı: " + name + "\n")
			continue
		}

		sqlText, err := dbmigrations.FS.ReadFile("migrations/" + name)
		if err != nil {
			return "", err
		}

		tx, err := conn.Begin(ctx)
		if err != nil {
			return "", err
		}
		if _, err := tx.Exec(ctx, string(sqlText)); err != nil {
			_ = tx.Rollback(ctx)
			return report.String(), fmt.Errorf("migration %s başarısız: %w", name, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES($1)`, name); err != nil {
			_ = tx.Rollback(ctx)
			return "", err
		}
		if err := tx.Commit(ctx); err != nil {
			return "", err
		}
		applied++
		report.WriteString("  uygulandı: " + name + "\n")
	}

	summary := fmt.Sprintf("Migration tamamlandı — %d yeni / %d toplam\n%s",
		applied, len(files), report.String())
	log.Println(summary)
	return summary, nil
}

func main() {
	// AWS Lambda runtime'ı varsa olay tabanlı; yoksa doğrudan çalıştır (lokal).
	if os.Getenv("AWS_LAMBDA_FUNCTION_NAME") != "" {
		lambda.Start(runMigrations)
		return
	}
	out, err := runMigrations(context.Background())
	if err != nil {
		log.Fatalf("migrate hatası: %v", err)
	}
	fmt.Println(out)
}
