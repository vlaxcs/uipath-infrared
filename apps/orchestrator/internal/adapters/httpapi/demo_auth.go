package httpapi

import (
	"net/http"
	"sync"
)

// demoAuth stands in for GitHub sign-in when ORCHESTRATOR_AUTH=off, on a loopback
// address only: one local demo user whose Disconnect and Connect work without
// GitHub or Postgres. The run API stays open either way.
type demoAuth struct {
	mu       sync.Mutex
	signedIn bool
}

const demoUser = "demo-cto"

func (d *demoAuth) me(w http.ResponseWriter, _ *http.Request) {
	d.mu.Lock()
	signedIn := d.signedIn
	d.mu.Unlock()
	if !signedIn {
		fail(w, http.StatusUnauthorized, "signed out")
		return
	}
	reply(w, http.StatusOK, map[string]any{"login": demoUser, "avatar_url": "", "credits": 5, "plan": "run_pack"})
}

func (d *demoAuth) logout(w http.ResponseWriter, _ *http.Request) {
	d.set(false)
	w.WriteHeader(http.StatusNoContent)
}

func (d *demoAuth) startDevice(w http.ResponseWriter, _ *http.Request) {
	reply(w, http.StatusOK, map[string]any{
		"user_code":        "DEMO-0000",
		"verification_uri": "https://github.com/login/device",
		"expires_in":       900,
		"interval":         1,
	})
}

func (d *demoAuth) pollDevice(w http.ResponseWriter, _ *http.Request) {
	d.set(true)
	reply(w, http.StatusOK, map[string]string{"status": "signed_in"})
}

func (d *demoAuth) set(signedIn bool) {
	d.mu.Lock()
	d.signedIn = signedIn
	d.mu.Unlock()
}

func withDemoAuth(api http.Handler) http.Handler {
	demo := &demoAuth{signedIn: true}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /me", demo.me)
	mux.HandleFunc("POST /auth/logout", demo.logout)
	mux.HandleFunc("POST /auth/device", demo.startDevice)
	mux.HandleFunc("POST /auth/device/poll", demo.pollDevice)
	mux.Handle("/", api)
	return mux
}
