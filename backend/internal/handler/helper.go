package handler

import (
	"encoding/json"
	"net/http"
)

// writeJSON response'u JSON olarak yazar. Handler'larda tekrar eden kod kalıbını ortadan kaldırır.
func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// writeError standart hata formatında JSON döner.
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// decodeJSON request body'yi verilen struct'a parse eder.
func decodeJSON(r *http.Request, dst any) error {
	return json.NewDecoder(r.Body).Decode(dst)
}

// pathValue Go 1.22+ net/http ServeMux path parametrelerini okur.
// Kullanım: id := pathValue(r, "id")
func pathValue(r *http.Request, name string) string {
	return r.PathValue(name)
}
