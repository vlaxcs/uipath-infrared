package httpapi

import (
	"context"
	"crypto/subtle"
	"errors"
	"net/http"
	"net/url"
	"strings"

	"infrared/orchestrator/internal/auth"
)

const (
	sessionCookie = "infrared_session"
	stateCookie   = "infrared_oauth_state"
	statePath     = "/auth/github"
	stateMaxAge   = 600
	deviceCookie  = "infrared_device"
	devicePath    = "/auth/device"
)

type Authenticator interface {
	NewState() (string, error)
	AuthorizeURL(state string) string
	SignIn(ctx context.Context, code string) (string, error)
	Authenticate(ctx context.Context, bearer, sessionToken string) (auth.Principal, error)
	SignOut(ctx context.Context, sessionToken string) error
	StartDevice(ctx context.Context) (auth.DeviceCode, error)
	PollDevice(ctx context.Context, deviceCode string) (string, error)
}

type AuthOptions struct {
	DashboardURL   string
	AllowedOrigins []string
}

func AuthenticatedHandler(runs Runs, authenticator Authenticator, options AuthOptions) http.Handler {
	gate := &gate{
		auth:      authenticator,
		dashboard: strings.TrimRight(options.DashboardURL, "/"),
		secure:    strings.HasPrefix(options.DashboardURL, "https://"),
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /auth/github", gate.start)
	mux.HandleFunc("GET /auth/github/callback", gate.callback)
	mux.HandleFunc("POST /auth/logout", gate.logout)
	mux.HandleFunc("POST /auth/device", gate.startDevice)
	mux.HandleFunc("POST /auth/device/poll", gate.pollDevice)
	mux.HandleFunc("GET /me", gate.me)
	mux.Handle("/", gate.require(routes(runs)))
	return withCORS(mux, options.AllowedOrigins)
}

type gate struct {
	auth      Authenticator
	dashboard string
	secure    bool
}

func (g *gate) start(w http.ResponseWriter, r *http.Request) {
	state, err := g.auth.NewState()
	if err != nil {
		fail(w, http.StatusInternalServerError, "could not start sign-in")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: stateCookie, Value: state, Path: statePath, MaxAge: stateMaxAge, HttpOnly: true, Secure: g.secure, SameSite: http.SameSiteLaxMode})
	http.Redirect(w, r, g.auth.AuthorizeURL(state), http.StatusFound)
}

func (g *gate) callback(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{Name: stateCookie, Path: statePath, MaxAge: -1, HttpOnly: true, Secure: g.secure, SameSite: http.SameSiteLaxMode})
	query := r.URL.Query()
	expected, err := r.Cookie(stateCookie)
	if err != nil || expected.Value == "" || subtle.ConstantTimeCompare([]byte(expected.Value), []byte(query.Get("state"))) != 1 {
		g.toLogin(w, r, "state")
		return
	}
	if query.Get("error") == "access_denied" {
		g.toLogin(w, r, "denied")
		return
	}
	code := query.Get("code")
	if code == "" {
		g.toLogin(w, r, "github")
		return
	}
	token, err := g.auth.SignIn(r.Context(), code)
	switch {
	case errors.Is(err, auth.ErrGitHub):
		g.toLogin(w, r, "github")
		return
	case err != nil:
		g.toLogin(w, r, "unavailable")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: token, Path: "/", MaxAge: int(auth.SessionLifetime.Seconds()), HttpOnly: true, Secure: g.secure, SameSite: http.SameSiteStrictMode})
	http.Redirect(w, r, g.dashboard+"/#/", http.StatusFound)
}

func (g *gate) startDevice(w http.ResponseWriter, r *http.Request) {
	code, err := g.auth.StartDevice(r.Context())
	if err != nil {
		fail(w, http.StatusBadGateway, "GitHub did not give a sign-in code; check that the GitHub App has Device Flow enabled")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: deviceCookie, Value: code.DeviceCode, Path: devicePath, MaxAge: code.ExpiresIn, HttpOnly: true, Secure: g.secure, SameSite: http.SameSiteStrictMode})
	reply(w, http.StatusOK, map[string]any{
		"user_code":        code.UserCode,
		"verification_uri": code.VerificationURI,
		"expires_in":       code.ExpiresIn,
		"interval":         code.Interval,
	})
}

func (g *gate) pollDevice(w http.ResponseWriter, r *http.Request) {
	device, err := r.Cookie(deviceCookie)
	if err != nil || device.Value == "" {
		reply(w, http.StatusOK, map[string]string{"status": "no_cookie"})
		return
	}
	token, err := g.auth.PollDevice(r.Context(), device.Value)
	switch {
	case errors.Is(err, auth.ErrPending):
		reply(w, http.StatusOK, map[string]string{"status": "pending"})
	case errors.Is(err, auth.ErrSlowDown):
		reply(w, http.StatusOK, map[string]string{"status": "slow_down"})
	case errors.Is(err, auth.ErrExpired):
		g.clearDevice(w)
		reply(w, http.StatusOK, map[string]string{"status": "expired"})
	case errors.Is(err, auth.ErrDenied):
		g.clearDevice(w)
		reply(w, http.StatusOK, map[string]string{"status": "denied"})
	case errors.Is(err, auth.ErrGitHub):
		fail(w, http.StatusBadGateway, "GitHub did not answer the sign-in check")
	case err != nil:
		fail(w, http.StatusServiceUnavailable, "sign-in is unavailable")
	default:
		g.clearDevice(w)
		http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: token, Path: "/", MaxAge: int(auth.SessionLifetime.Seconds()), HttpOnly: true, Secure: g.secure, SameSite: http.SameSiteStrictMode})
		reply(w, http.StatusOK, map[string]string{"status": "signed_in"})
	}
}

func (g *gate) clearDevice(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: deviceCookie, Path: devicePath, MaxAge: -1, HttpOnly: true, Secure: g.secure, SameSite: http.SameSiteStrictMode})
}

func (g *gate) toLogin(w http.ResponseWriter, r *http.Request, reason string) {
	http.Redirect(w, r, g.dashboard+"/?login_error="+url.QueryEscape(reason)+"#/login", http.StatusFound)
}

func (g *gate) logout(w http.ResponseWriter, r *http.Request) {
	if err := g.auth.SignOut(r.Context(), sessionToken(r)); err != nil {
		fail(w, http.StatusServiceUnavailable, "sign-in is unavailable")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Path: "/", MaxAge: -1, HttpOnly: true, Secure: g.secure, SameSite: http.SameSiteStrictMode})
	w.WriteHeader(http.StatusNoContent)
}

func (g *gate) me(w http.ResponseWriter, r *http.Request) {
	principal, ok := g.principal(w, r)
	if !ok {
		return
	}
	if principal.User == nil {
		fail(w, http.StatusForbidden, "the service token has no user")
		return
	}
	reply(w, http.StatusOK, map[string]any{
		"login":      principal.User.Login,
		"avatar_url": principal.User.AvatarURL,
		"credits":    principal.User.Credits,
		"plan":       "run_pack",
	})
}

func (g *gate) require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := g.principal(w, r); ok {
			next.ServeHTTP(w, r)
		}
	})
}

func (g *gate) principal(w http.ResponseWriter, r *http.Request) (auth.Principal, bool) {
	principal, err := g.auth.Authenticate(r.Context(), bearer(r), sessionToken(r))
	switch {
	case errors.Is(err, auth.ErrNoSession):
		fail(w, http.StatusUnauthorized, "sign in first")
		return auth.Principal{}, false
	case err != nil:
		fail(w, http.StatusServiceUnavailable, "sign-in is unavailable")
		return auth.Principal{}, false
	}
	return principal, true
}

func bearer(r *http.Request) string {
	scheme, token, found := strings.Cut(r.Header.Get("Authorization"), " ")
	if !found || !strings.EqualFold(scheme, "Bearer") {
		return ""
	}
	return strings.TrimSpace(token)
}

func sessionToken(r *http.Request) string {
	cookie, err := r.Cookie(sessionCookie)
	if err != nil {
		return ""
	}
	return cookie.Value
}
