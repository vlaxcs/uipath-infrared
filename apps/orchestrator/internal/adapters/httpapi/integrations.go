package httpapi

import (
	"net/http"
	"sync"
	"time"
)

// The Slack bot names itself on every request; the dashboard asks whether it is still polling.
const (
	clientHeader  = "X-Infrared-Client"
	channelHeader = "X-Infrared-Slack-Channel"
	slackClient   = "slack-bot"
	slackFresh    = 15 * time.Second
)

type presence struct {
	mu      sync.Mutex
	seen    time.Time
	channel string
	now     func() time.Time
}

type slackStatus struct {
	Connected bool    `json:"connected"`
	Channel   string  `json:"channel,omitempty"`
	LastSeen  *string `json:"last_seen,omitempty"`
}

func (p *presence) observe(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get(clientHeader) == slackClient {
			p.mu.Lock()
			p.seen = p.now()
			p.channel = r.Header.Get(channelHeader)
			p.mu.Unlock()
		}
		next.ServeHTTP(w, r)
	})
}

func (p *presence) integrations(w http.ResponseWriter, _ *http.Request) {
	p.mu.Lock()
	seen, channel := p.seen, p.channel
	p.mu.Unlock()
	status := slackStatus{Connected: !seen.IsZero() && p.now().Sub(seen) <= slackFresh, Channel: channel}
	if !seen.IsZero() {
		at := seen.UTC().Format(time.RFC3339)
		status.LastSeen = &at
	}
	reply(w, http.StatusOK, map[string]slackStatus{"slack": status})
}
