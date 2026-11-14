package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestTheDemoUserCanDisconnectAndConnectAgain(t *testing.T) {
	handler := withDemoAuth(http.NotFoundHandler())
	call := func(method, path string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, httptest.NewRequest(method, path, nil))
		return recorder
	}

	if got := call(http.MethodGet, "/me"); got.Code != http.StatusOK || !strings.Contains(got.Body.String(), demoUser) {
		t.Fatalf("signed in at start: %d %s", got.Code, got.Body)
	}
	if got := call(http.MethodPost, "/auth/logout"); got.Code != http.StatusNoContent {
		t.Fatalf("logout: %d", got.Code)
	}
	if got := call(http.MethodGet, "/me"); got.Code != http.StatusUnauthorized {
		t.Fatalf("after logout: %d", got.Code)
	}
	if got := call(http.MethodPost, "/auth/device"); got.Code != http.StatusOK || !strings.Contains(got.Body.String(), "user_code") {
		t.Fatalf("device start: %d %s", got.Code, got.Body)
	}
	if got := call(http.MethodPost, "/auth/device/poll"); !strings.Contains(got.Body.String(), "signed_in") {
		t.Fatalf("device poll: %s", got.Body)
	}
	if got := call(http.MethodGet, "/me"); got.Code != http.StatusOK {
		t.Fatalf("after connect: %d", got.Code)
	}
}
