// Package ai — Gemini REST API client.
// Generative Language API v1beta endpoint'i üzerinden Gemini'yi çağırır.
// Tek atışlık (structured output) ve function-calling (multi-turn) destekler.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const (
	DefaultModel = "gemini-2.5-flash"
	FastModel    = "gemini-2.5-flash"
	apiBase      = "https://generativelanguage.googleapis.com/v1beta/models"
)

// GeminiClient Gemini Generative Language API'sine REST üzerinden istek atar.
type GeminiClient struct {
	apiKey string
	http   *http.Client
}

func NewGeminiClient() (*GeminiClient, error) {
	key := os.Getenv("GEMINI_API_KEY")
	if key == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY ortam değişkeni boş")
	}
	return &GeminiClient{
		apiKey: key,
		http:   &http.Client{Timeout: 300 * time.Second},
	}, nil
}

// ─── Gemini Wire Types ────────────────────────────────────────────────────────

type Part struct {
	Text             string            `json:"text,omitempty"`
	FunctionCall     *FunctionCall     `json:"functionCall,omitempty"`
	FunctionResponse *FunctionResponse `json:"functionResponse,omitempty"`
}

type FunctionCall struct {
	Name string                 `json:"name"`
	Args map[string]interface{} `json:"args"`
}

type FunctionResponse struct {
	Name     string                 `json:"name"`
	Response map[string]interface{} `json:"response"`
}

type Content struct {
	Role  string `json:"role,omitempty"` // "user" | "model"
	Parts []Part `json:"parts"`
}

type Tool struct {
	FunctionDeclarations []FunctionDeclaration `json:"functionDeclarations"`
}

type FunctionDeclaration struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

type GenerationConfig struct {
	Temperature      float64                `json:"temperature,omitempty"`
	ResponseMimeType string                 `json:"responseMimeType,omitempty"`
	ResponseSchema   map[string]interface{} `json:"responseSchema,omitempty"`
}

type generateRequest struct {
	Contents          []Content         `json:"contents"`
	Tools             []Tool            `json:"tools,omitempty"`
	SystemInstruction *Content          `json:"systemInstruction,omitempty"`
	GenerationConfig  *GenerationConfig `json:"generationConfig,omitempty"`
}

type Candidate struct {
	Content      Content `json:"content"`
	FinishReason string  `json:"finishReason"`
}

type GenerateResponse struct {
	Candidates []Candidate `json:"candidates"`
}

// ─── API Calls ────────────────────────────────────────────────────────────────

// GenerateStructured tek atışlık çağrı. JSON schema verilirse Gemini buna uygun JSON döner.
func (c *GeminiClient) GenerateStructured(
	ctx context.Context,
	model string,
	systemPrompt string,
	userPrompt string,
	responseSchema map[string]interface{},
) ([]byte, error) {
	req := generateRequest{
		Contents: []Content{
			{Role: "user", Parts: []Part{{Text: userPrompt}}},
		},
		GenerationConfig: &GenerationConfig{
			Temperature:      0.7,
			ResponseMimeType: "application/json",
			ResponseSchema:   responseSchema,
		},
	}
	if systemPrompt != "" {
		req.SystemInstruction = &Content{Parts: []Part{{Text: systemPrompt}}}
	}

	resp, err := c.call(ctx, model, &req)
	if err != nil {
		return nil, err
	}
	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("Gemini boş yanıt döndü")
	}
	return []byte(resp.Candidates[0].Content.Parts[0].Text), nil
}

// GenerateWithTools function-calling için multi-turn çağrı.
// history önceki adımları içerir, tools agent'ın çağırabileceği fonksiyonları tanımlar.
func (c *GeminiClient) GenerateWithTools(
	ctx context.Context,
	model string,
	systemPrompt string,
	history []Content,
	tools []Tool,
) (*Candidate, error) {
	req := generateRequest{
		Contents: history,
		Tools:    tools,
		GenerationConfig: &GenerationConfig{
			Temperature: 0.6,
		},
	}
	if systemPrompt != "" {
		req.SystemInstruction = &Content{Parts: []Part{{Text: systemPrompt}}}
	}

	resp, err := c.call(ctx, model, &req)
	if err != nil {
		return nil, err
	}
	if len(resp.Candidates) == 0 {
		return nil, fmt.Errorf("Gemini boş yanıt döndü")
	}
	return &resp.Candidates[0], nil
}

func (c *GeminiClient) call(ctx context.Context, model string, req *generateRequest) (*GenerateResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("istek marshal hatası: %w", err)
	}

	url := fmt.Sprintf("%s/%s:generateContent?key=%s", apiBase, model, c.apiKey)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("istek oluşturulamadı: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	// 1 retry — geçici 5xx ve network hatalarına karşı.
	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * 2 * time.Second)
		}
		httpResp, err := c.http.Do(httpReq.Clone(ctx))
		if err != nil {
			lastErr = err
			continue
		}
		respBody, _ := io.ReadAll(httpResp.Body)
		httpResp.Body.Close()

		if httpResp.StatusCode >= 500 {
			lastErr = fmt.Errorf("Gemini %d: %s", httpResp.StatusCode, string(respBody))
			continue
		}
		if httpResp.StatusCode >= 400 {
			return nil, fmt.Errorf("Gemini %d: %s", httpResp.StatusCode, string(respBody))
		}

		var resp GenerateResponse
		if err := json.Unmarshal(respBody, &resp); err != nil {
			return nil, fmt.Errorf("yanıt parse edilemedi: %w (body: %s)", err, string(respBody))
		}
		return &resp, nil
	}
	return nil, fmt.Errorf("Gemini çağrısı başarısız: %w", lastErr)
}
