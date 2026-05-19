// Package dbmigrations, SQL migration dosyalarını derleme zamanında binary'ye
// gömer. Böylece migrate Lambda'sı dosya sistemine ihtiyaç duymadan RDS'e şemayı
// uygulayabilir.
package dbmigrations

import "embed"

// FS, migrations/ klasöründeki tüm .sql dosyalarını içerir.
//
//go:embed migrations/*.sql
var FS embed.FS
