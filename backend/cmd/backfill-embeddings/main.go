// backfill-embeddings — published_products tablosundaki embedding'i olmayan
// ürünleri toplu olarak Gemini ile vektörler.
//
// Kullanım:
//
//	cd backend
//	go run ./cmd/backfill-embeddings
//
// Gerekli ortam değişkenleri: DATABASE_URL, GEMINI_API_KEY.
// AI Çözüm Asistanı'nın anlamsal araması yalnızca embedding'i olan ürünleri görür;
// yeni ürünler publish sırasında otomatik embedlenir, eski ürünler için bu komut.
package main

import (
	"context"
	"log"
	"os"
	"time"

	"go-backend-projem/internal/ai"
	dbpkg "go-backend-projem/internal/db"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL ortam değişkeni gerekli")
	}

	gemini, err := ai.NewGeminiClient()
	if err != nil {
		log.Fatalf("Gemini istemcisi: %v", err)
	}

	ctx := context.Background()
	pool, err := dbpkg.NewPool(ctx, dbURL)
	if err != nil {
		log.Fatalf("Veritabanı bağlantısı: %v", err)
	}
	defer pool.Close()
	store := dbpkg.NewStore(pool)

	total, failed := 0, 0
	for {
		prods, err := store.ListPublishedProductsWithoutEmbedding(ctx, 50)
		if err != nil {
			log.Fatalf("Ürün listesi alınamadı: %v", err)
		}
		if len(prods) == 0 {
			break
		}

		batchOK := 0
		for _, p := range prods {
			emb, err := gemini.GenerateEmbedding(ctx, p.EmbedText())
			if err != nil {
				log.Printf("  ✗ %s — embedding: %v", p.Title, err)
				failed++
				continue
			}
			if err := store.UpdatePublishedProductEmbedding(ctx, p.ID, emb); err != nil {
				log.Printf("  ✗ %s — kayıt: %v", p.Title, err)
				failed++
				continue
			}
			batchOK++
			total++
			log.Printf("  ✓ %s", p.Title)
			time.Sleep(100 * time.Millisecond) // API'ye nezaket
		}

		// Hiçbiri başarılı olmadıysa: kalanlar hep aynı şekilde başarısız olur,
		// sonsuz döngüye girmemek için dur.
		if batchOK == 0 {
			log.Printf("Bu partide hiçbir ürün vektörlenemedi, durduruluyor.")
			break
		}
	}

	log.Printf("Tamamlandı — %d ürün vektörlendi, %d başarısız.", total, failed)
}
