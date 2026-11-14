package httpapi_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"infrared/orchestrator/internal/adapters/httpapi"
)

const dashboard = "http://127.0.0.1:5173"

func fromOrigin(method, path, origin string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, nil)
	request.Header.Set("Origin", origin)
	if method == http.MethodOptions {
		request.Header.Set("Access-Control-Request-Method", http.MethodPost)
	}
	recorder := httptest.NewRecorder()
	httpapi.Handler(&fakeRuns{}, dashboard).ServeHTTP(recorder, request)
	return recorder
}

func TestAnAllowedOriginCanReadTheAPI(t *testing.T) {
	answer := fromOrigin(http.MethodGet, "/runs", dashboard)
	if answer.Code != http.StatusOK || answer.Header().Get("Access-Control-Allow-Origin") != dashboard {
		t.Fatalf("status %d, allow-origin %q", answer.Code, answer.Header().Get("Access-Control-Allow-Origin"))
	}
	if answer.Header().Get("Vary") != "Origin" {
		t.Fatalf("Vary is %q", answer.Header().Get("Vary"))
	}
}

func TestAnAllowedOriginPassesThePreflightForADecision(t *testing.T) {
	answer := fromOrigin(http.MethodOptions, "/runs/run-startup-0001/decisions", dashboard)
	if answer.Code != http.StatusNoContent {
		t.Fatalf("status %d", answer.Code)
	}
	if answer.Header().Get("Access-Control-Allow-Origin") != dashboard || answer.Header().Get("Access-Control-Allow-Headers") != "Content-Type, Authorization" {
		t.Fatalf("headers %v", answer.Header())
	}
}

func TestAnAllowedOriginPassesThePreflightForSavingTheProfile(t *testing.T) {
	request := httptest.NewRequest(http.MethodOptions, "/profile", nil)
	request.Header.Set("Origin", dashboard)
	request.Header.Set("Access-Control-Request-Method", http.MethodPut)
	recorder := httptest.NewRecorder()
	httpapi.Handler(&fakeRuns{}, dashboard).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNoContent || !strings.Contains(recorder.Header().Get("Access-Control-Allow-Methods"), http.MethodPut) {
		t.Fatalf("status %d, methods %q", recorder.Code, recorder.Header().Get("Access-Control-Allow-Methods"))
	}
}

func TestAnyOtherOriginGetsNoCORSHeaders(t *testing.T) {
	for _, method := range []string{http.MethodGet, http.MethodOptions} {
		answer := fromOrigin(method, "/runs", "https://evil.example")
		if answer.Header().Get("Access-Control-Allow-Origin") != "" {
			t.Fatalf("%s: allow-origin %q for an unknown origin", method, answer.Header().Get("Access-Control-Allow-Origin"))
		}
	}
	if answer := fromOrigin(http.MethodOptions, "/runs", "https://evil.example"); answer.Code != http.StatusForbidden {
		t.Fatalf("preflight from an unknown origin: status %d", answer.Code)
	}
}

func TestWithoutAllowedOriginsTheAPIStaysSameOrigin(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/runs", nil)
	request.Header.Set("Origin", dashboard)
	recorder := httptest.NewRecorder()
	httpapi.Handler(&fakeRuns{}).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || recorder.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("status %d allow-origin %q", recorder.Code, recorder.Header().Get("Access-Control-Allow-Origin"))
	}
}
