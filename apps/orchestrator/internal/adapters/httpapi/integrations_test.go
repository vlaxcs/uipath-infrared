package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSlackShowsConnectedWhileTheBotPolls(t *testing.T) {
	clock := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	seen := &presence{now: func() time.Time { return clock }}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /integrations", seen.integrations)
	mux.HandleFunc("GET /runs", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	handler := seen.observe(mux)

	ask := func() slackStatus {
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/integrations", nil))
		var body map[string]slackStatus
		if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		return body["slack"]
	}

	if ask().Connected {
		t.Fatal("connected before the bot polled")
	}
	poll := httptest.NewRequest(http.MethodGet, "/runs", nil)
	poll.Header.Set(clientHeader, slackClient)
	poll.Header.Set(channelHeader, "infrared-runs")
	handler.ServeHTTP(httptest.NewRecorder(), poll)
	if got := ask(); !got.Connected || got.Channel != "infrared-runs" {
		t.Fatalf("after a poll: %+v", got)
	}
	clock = clock.Add(slackFresh + time.Second)
	if ask().Connected {
		t.Fatal("still connected after the bot went quiet")
	}
}
