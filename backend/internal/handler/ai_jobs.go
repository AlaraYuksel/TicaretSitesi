package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"go-backend-projem/internal/db"
	"go-backend-projem/internal/middleware"
	"go-backend-projem/internal/queue"
)

// ═══════════════════════════════════════════════════════════════════════════════
// AI ASENKRON İŞ KUYRUĞU
//
// AI işlemleri (plan/execute/solve) ~1-2 dk sürer — API Gateway 30sn limitini
// aşar. Bu yüzden:
//   - ai-api Lambda (HTTP): işi başlatır (ai_jobs kaydı + SQS), job_id döndürür;
//     durum endpoint'i işi poll'lar.
//   - ai-worker Lambda (SQS): işi RunAIJob ile çalıştırır.
//
// RunAIJob, mevcut SSE handler'larını (PlanSite/ExecutePlan/Solve) DEĞİŞTİRMEDEN
// yeniden kullanır: jobWriter adında sahte bir http.ResponseWriter ile çağrılır;
// jobWriter, SSE olaylarını (veya JSON gövdesini) yakalayıp ai_jobs'a yazar.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── HTTP: İş başlatma / durum (ai-api Lambda) ───────────────────────────────

type AIJobHandler struct {
	store *db.Store
	queue *queue.Sender // ai-jobs kuyruğu (prod) — nil ise lokal mod

	// builder/solver yalnızca LOKAL mod (queue==nil) içindir: SQS olmadığı
	// için iş arka plan goroutine'inde RunAIJob ile çalıştırılır.
	builder *AISiteBuilderHandler
	solver  *AISolverHandler
}

// NewAIJobHandler — prod'da queue verilir (builder/solver nil olabilir);
// lokal monolitte queue nil, builder+solver verilir (inline çalıştırma).
func NewAIJobHandler(store *db.Store, q *queue.Sender, builder *AISiteBuilderHandler, solver *AISolverHandler) *AIJobHandler {
	return &AIJobHandler{store: store, queue: q, builder: builder, solver: solver}
}

// startJob ortak: ai_jobs kaydı oluşturur; prod'da SQS'e atar, lokalde arka
// plan goroutine'inde çalıştırır; her durumda job_id döndürür.
func (h *AIJobHandler) startJob(w http.ResponseWriter, r *http.Request, kind string, params interface{}) {
	userID := middleware.UserIDFromCtx(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "Yetkilendirme gerekli")
		return
	}
	if h.queue == nil && h.builder == nil {
		writeError(w, http.StatusServiceUnavailable, "AI servisi yapılandırılmamış")
		return
	}
	raw, _ := json.Marshal(params)
	job, err := h.store.CreateAIJob(r.Context(), userID, kind, raw)
	if err != nil {
		log.Printf("AI job oluşturulamadı: %v", err)
		writeError(w, http.StatusInternalServerError, "İş oluşturulamadı")
		return
	}
	if h.queue != nil {
		// Prod: SQS'e at — ai-worker Lambda işler.
		if err := h.queue.Send(r.Context(), queue.AIJobMessage{JobID: job.ID}); err != nil {
			log.Printf("AI job SQS gönderimi başarısız (job=%s): %v", job.ID, err)
			writeError(w, http.StatusInternalServerError, "İş kuyruğa alınamadı")
			return
		}
	} else {
		// Lokal: SQS yok → arka plan goroutine'inde çalıştır.
		go RunAIJob(context.Background(), h.store, h.builder, h.solver, job)
	}
	writeJSON(w, http.StatusAccepted, map[string]string{"job_id": job.ID})
}

// POST /api/ai/build-site/plan — plan işi başlatır.
func (h *AIJobHandler) StartPlan(w http.ResponseWriter, r *http.Request) {
	var req planRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}
	if strings.TrimSpace(req.Prompt) == "" || req.SiteID == "" {
		writeError(w, http.StatusBadRequest, "prompt ve site_id zorunlu")
		return
	}
	h.startJob(w, r, "plan", req)
}

// POST /api/ai/build-site/execute — plan işinin sonucundan execute işi başlatır.
func (h *AIJobHandler) StartExecute(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PlanJobID string `json:"plan_job_id"`
		SiteID    string `json:"site_id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}
	if req.PlanJobID == "" || req.SiteID == "" {
		writeError(w, http.StatusBadRequest, "plan_job_id ve site_id zorunlu")
		return
	}
	userID := middleware.UserIDFromCtx(r.Context())
	planJob, err := h.store.GetAIJob(r.Context(), req.PlanJobID, userID)
	if err != nil || planJob.Kind != "plan" || planJob.Status != "done" {
		writeError(w, http.StatusBadRequest, "Plan işi bulunamadı veya tamamlanmamış")
		return
	}
	// Plan işinin sonucu planResponse{plan_id, plan}; girdileri (prompt) params'ta.
	var planRes planResponse
	_ = json.Unmarshal(planJob.Result, &planRes)
	var planParams planRequest
	_ = json.Unmarshal(planJob.Params, &planParams)
	if len(planRes.Plan) == 0 {
		writeError(w, http.StatusBadRequest, "Plan içeriği boş")
		return
	}
	h.startJob(w, r, "execute", map[string]interface{}{
		"plan_id": planRes.PlanID,
		"plan":    planRes.Plan,
		"prompt":  planParams.Prompt,
		"site_id": req.SiteID,
	})
}

// POST /api/marketplace/ai-solver/solve — çözüm işi başlatır.
func (h *AIJobHandler) StartSolve(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Problem string `json:"problem"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Geçersiz JSON")
		return
	}
	if strings.TrimSpace(req.Problem) == "" {
		writeError(w, http.StatusBadRequest, "problem zorunlu")
		return
	}
	h.startJob(w, r, "solve", req)
}

// GET /api/ai/jobs/{id} — iş durumunu döndürür (frontend bunu poll'lar).
func (h *AIJobHandler) GetJob(w http.ResponseWriter, r *http.Request) {
	id := pathValue(r, "id")
	userID := middleware.UserIDFromCtx(r.Context())
	job, err := h.store.GetAIJob(r.Context(), id, userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "İş bulunamadı")
		return
	}
	writeJSON(w, http.StatusOK, job)
}

// ─── jobWriter — SSE/JSON çıktısını ai_jobs'a yakalar ────────────────────────

// jobWriter, http.ResponseWriter + http.Flusher implement eder. Sarmaladığı
// handler SSE yazınca ("data: {...}\n\n"), her olayı ai_jobs.events'e ekler.
// JSON gövde yazılırsa (plan handler'ı) gövdeyi result olarak biriktirir.
type jobWriter struct {
	ctx      context.Context
	store    *db.Store
	jobID    string
	hdr      http.Header
	status   int
	decided  bool
	sse      bool
	sseBuf   bytes.Buffer
	plainBuf bytes.Buffer
	sawError bool
}

func newJobWriter(ctx context.Context, store *db.Store, jobID string) *jobWriter {
	return &jobWriter{ctx: ctx, store: store, jobID: jobID, hdr: http.Header{}, status: 200}
}

func (jw *jobWriter) Header() http.Header { return jw.hdr }

func (jw *jobWriter) WriteHeader(code int) { jw.status = code }

func (jw *jobWriter) Flush() {}

func (jw *jobWriter) Write(p []byte) (int, error) {
	if !jw.decided {
		jw.decided = true
		jw.sse = strings.Contains(jw.hdr.Get("Content-Type"), "event-stream")
	}
	if !jw.sse {
		jw.plainBuf.Write(p)
		return len(p), nil
	}
	// SSE: tamamlanan "data: ...\n\n" bloklarını ayıkla
	jw.sseBuf.Write(p)
	for {
		s := jw.sseBuf.Bytes()
		idx := bytes.Index(s, []byte("\n\n"))
		if idx < 0 {
			break
		}
		block := string(s[:idx])
		jw.sseBuf.Next(idx + 2)
		for _, line := range strings.Split(block, "\n") {
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			ev := json.RawMessage(strings.TrimPrefix(line, "data: "))
			jw.recordEvent(ev)
		}
	}
	return len(p), nil
}

func (jw *jobWriter) recordEvent(ev json.RawMessage) {
	var probe struct {
		Type string `json:"type"`
	}
	_ = json.Unmarshal(ev, &probe)
	if probe.Type == "error" {
		jw.sawError = true
	}
	if err := jw.store.AppendAIJobEvent(jw.ctx, jw.jobID, ev); err != nil {
		log.Printf("AI job event yazılamadı (job=%s): %v", jw.jobID, err)
	}
}

// finalize — handler bittikten sonra işi sonuçlandırır.
func (jw *jobWriter) finalize() {
	status := "done"
	var result json.RawMessage
	errMsg := ""
	if jw.sse {
		if jw.sawError {
			status = "error"
		}
	} else {
		// JSON gövde modu (plan) — gövde result'tır.
		result = json.RawMessage(jw.plainBuf.Bytes())
		if jw.status >= 400 {
			status = "error"
			errMsg = "AI plan üretilemedi"
		}
	}
	if err := jw.store.FinishAIJob(jw.ctx, jw.jobID, status, result, errMsg); err != nil {
		log.Printf("AI job sonlandırılamadı (job=%s): %v", jw.jobID, err)
	}
}

// ─── RunAIJob — worker (ai-worker Lambda) ────────────────────────────────────

// RunAIJob bir ai_jobs kaydını işler. Mevcut handler'ları jobWriter ile çağırır.
func RunAIJob(
	ctx context.Context,
	store *db.Store,
	builder *AISiteBuilderHandler,
	solver *AISolverHandler,
	job *db.AIJob,
) {
	_ = store.SetAIJobRunning(ctx, job.ID)

	// Handler'lar middleware.UserIDFromCtx ile user'ı context'ten okur.
	reqCtx := context.WithValue(context.Background(), middleware.UserIDKey, job.UserID)
	jw := newJobWriter(ctx, store, job.ID)

	var bodyJSON string
	var run func(w http.ResponseWriter, r *http.Request)

	switch job.Kind {
	case "plan":
		bodyJSON = string(job.Params) // {site_id, prompt, style}
		run = builder.PlanSite

	case "execute":
		var p struct {
			PlanID string          `json:"plan_id"`
			Plan   json.RawMessage `json:"plan"`
			Prompt string          `json:"prompt"`
			SiteID string          `json:"site_id"`
		}
		if err := json.Unmarshal(job.Params, &p); err != nil {
			_ = store.FinishAIJob(ctx, job.ID, "error", nil, "geçersiz iş parametresi")
			return
		}
		// ExecutePlan planı planCache'ten okur — worker'da önceden yerleştir.
		builder.planCache.put(p.PlanID, cachedPlan{
			plan:      p.Plan,
			prompt:    p.Prompt,
			siteID:    p.SiteID,
			userID:    job.UserID,
			createdAt: time.Now(),
		})
		eb, _ := json.Marshal(executeRequest{PlanID: p.PlanID, SiteID: p.SiteID})
		bodyJSON = string(eb)
		run = builder.ExecutePlan

	case "solve":
		bodyJSON = string(job.Params) // {problem}
		run = solver.Solve

	default:
		_ = store.FinishAIJob(ctx, job.ID, "error", nil, "bilinmeyen iş tipi: "+job.Kind)
		return
	}

	req, _ := http.NewRequestWithContext(reqCtx, http.MethodPost, "/", io.NopCloser(strings.NewReader(bodyJSON)))
	req.Header.Set("Content-Type", "application/json")

	func() {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("AI job panik (job=%s): %v", job.ID, rec)
				_ = store.FinishAIJob(ctx, job.ID, "error", nil, "AI işi beklenmedik şekilde sonlandı")
			}
		}()
		run(jw, req)
		jw.finalize()
	}()
}
