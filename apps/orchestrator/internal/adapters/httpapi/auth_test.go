package httpapi_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"infrared/orchestrator/internal/adapters/httpapi"
	"infrared/orchestrator/internal/auth"
)

const (
	serviceToken = "service-token-that-is-at-least-32-chars"
	dashboardApp = "http://127.0.0.1:5173/app"
)

type memoryStore struct {
	sessions map[string]auth.User
	down     bool
}

func (m *memoryStore) SignIn(_ context.Context, identity auth.Identity, hash []byte, _ time.Time) error {
	if m.down {
		return errors.New("connection refused")
	}
	m.sessions[string(hash)] = auth.User{ID: 1, Login: identity.Login, AvatarURL: identity.AvatarURL, Credits: 5}
	return nil
}

func (m *memoryStore) UserBySession(_ context.Context, hash []byte, _ time.Time) (auth.User, error) {
	if m.down {
		return auth.User{}, errors.New("connection refused")
	}
	user, ok := m.sessions[string(hash)]
	if !ok {
		return auth.User{}, auth.ErrNoSession
	}
	return user, nil
}

func (m *memoryStore) EndSession(_ context.Context, hash []byte) error {
	delete(m.sessions, string(hash))
	return nil
}

func (m *memoryStore) DeleteExpired(context.Context, time.Time) (int64, error) { return 0, nil }

type stubGitHub struct {
	err     error
	pollErr error
}

func (g stubGitHub) StartDevice(context.Context) (auth.DeviceCode, error) {
	return auth.DeviceCode{DeviceCode: "device-secret", UserCode: "WDJB-MJHT", VerificationURI: "https://github.com/login/device", ExpiresIn: 900, Interval: 5}, g.err
}

func (g stubGitHub) PollDevice(context.Context, string) (auth.Identity, error) {
	return auth.Identity{GithubID: 1, Login: "octocat", AvatarURL: "https://avatars.test/1"}, g.pollErr
}

func (stubGitHub) AuthorizeURL(state string) string {
	return "https://github.test/login/oauth/authorize?state=" + url.QueryEscape(state)
}

func (g stubGitHub) Identify(context.Context, string) (auth.Identity, error) {
	return auth.Identity{GithubID: 1, Login: "octocat", AvatarURL: "https://avatars.test/1"}, g.err
}

type platform struct {
	t       *testing.T
	store   *memoryStore
	handler http.Handler
}

func newPlatform(t *testing.T, github stubGitHub) *platform {
	store := &memoryStore{sessions: map[string]auth.User{}}
	service := auth.NewService(store, github, serviceToken, time.Now)
	handler := httpapi.AuthenticatedHandler(&fakeRuns{}, service, httpapi.AuthOptions{DashboardURL: dashboardApp, AllowedOrigins: []string{dashboard}})
	return &platform{t: t, store: store, handler: handler}
}

func (p *platform) do(request *http.Request) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	p.handler.ServeHTTP(recorder, request)
	return recorder
}

func cookieNamed(recorder *httptest.ResponseRecorder, name string) *http.Cookie {
	for _, cookie := range recorder.Result().Cookies() {
		if cookie.Name == name {
			return cookie
		}
	}
	return nil
}

func (p *platform) signIn() *http.Cookie {
	p.t.Helper()
	start := p.do(httptest.NewRequest(http.MethodGet, "/auth/github", nil))
	state := cookieNamed(start, "infrared_oauth_state")
	callback := httptest.NewRequest(http.MethodGet, "/auth/github/callback?code=the-code&state="+url.QueryEscape(state.Value), nil)
	callback.AddCookie(state)
	answer := p.do(callback)
	session := cookieNamed(answer, "infrared_session")
	if session == nil {
		p.t.Fatalf("no session cookie; status %d, location %q", answer.Code, answer.Header().Get("Location"))
	}
	return session
}

func TestSignInRedirectsToGitHubWithAStateCookie(t *testing.T) {
	answer := newPlatform(t, stubGitHub{}).do(httptest.NewRequest(http.MethodGet, "/auth/github", nil))
	if answer.Code != http.StatusFound {
		t.Fatalf("status %d", answer.Code)
	}
	state := cookieNamed(answer, "infrared_oauth_state")
	if state == nil || !state.HttpOnly || state.SameSite != http.SameSiteLaxMode || state.Path != "/auth/github" || state.MaxAge != 600 {
		t.Fatalf("state cookie %+v", state)
	}
	location, _ := url.Parse(answer.Header().Get("Location"))
	if location.Host != "github.test" || location.Query().Get("state") != state.Value {
		t.Fatalf("location %s", location)
	}
}

func TestTheCallbackOpensASessionAndReturnsToTheDashboard(t *testing.T) {
	p := newPlatform(t, stubGitHub{})
	start := p.do(httptest.NewRequest(http.MethodGet, "/auth/github", nil))
	state := cookieNamed(start, "infrared_oauth_state")
	callback := httptest.NewRequest(http.MethodGet, "/auth/github/callback?code=c&state="+url.QueryEscape(state.Value), nil)
	callback.AddCookie(state)

	answer := p.do(callback)

	if answer.Code != http.StatusFound || answer.Header().Get("Location") != dashboardApp+"/#/" {
		t.Fatalf("status %d, location %q", answer.Code, answer.Header().Get("Location"))
	}
	session := cookieNamed(answer, "infrared_session")
	if session == nil || !session.HttpOnly || session.SameSite != http.SameSiteStrictMode || session.Path != "/" || session.MaxAge != 30*24*3600 || session.Secure {
		t.Fatalf("session cookie %+v", session)
	}
	if cleared := cookieNamed(answer, "infrared_oauth_state"); cleared == nil || cleared.MaxAge >= 0 {
		t.Fatalf("state cookie not cleared: %+v", cleared)
	}
	if len(p.store.sessions) != 1 {
		t.Fatalf("sessions %d", len(p.store.sessions))
	}
}

func TestCallbackFailuresReturnToLoginWithAReason(t *testing.T) {
	cases := []struct {
		name   string
		github stubGitHub
		query  string
		state  bool
		down   bool
		reason string
	}{
		{name: "no state cookie", query: "code=c&state=x", reason: "state"},
		{name: "state mismatch", query: "code=c&state=other", state: true, reason: "state"},
		{name: "denied on GitHub", query: "error=access_denied&state=", state: true, reason: "denied"},
		{name: "GitHub fails", github: stubGitHub{err: errors.New("bad_verification_code")}, query: "code=c&state=", state: true, reason: "github"},
		{name: "no code", query: "state=", state: true, reason: "github"},
		{name: "database down", query: "code=c&state=", state: true, down: true, reason: "unavailable"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			p := newPlatform(t, c.github)
			p.store.down = c.down
			query := c.query
			request := httptest.NewRequest(http.MethodGet, "/auth/github/callback", nil)
			if c.state {
				state := cookieNamed(p.do(httptest.NewRequest(http.MethodGet, "/auth/github", nil)), "infrared_oauth_state")
				request.AddCookie(state)
				if strings.HasSuffix(query, "state=") {
					query += url.QueryEscape(state.Value)
				}
			}
			request.URL.RawQuery = query
			answer := p.do(request)
			if answer.Code != http.StatusFound || answer.Header().Get("Location") != dashboardApp+"/?login_error="+c.reason+"#/login" {
				t.Fatalf("status %d, location %q", answer.Code, answer.Header().Get("Location"))
			}
			if cookieNamed(answer, "infrared_session") != nil {
				t.Fatal("a session cookie was set")
			}
		})
	}
}

func TestEveryAPIRouteNeedsASession(t *testing.T) {
	p := newPlatform(t, stubGitHub{})
	for _, route := range []struct{ method, path string }{
		{http.MethodGet, "/runs"},
		{http.MethodGet, "/runs/run-startup-0001"},
		{http.MethodPost, "/runs/run-startup-0001/decisions"},
		{http.MethodGet, "/profile"},
		{http.MethodGet, "/onboarding"},
		{http.MethodGet, "/me"},
	} {
		answer := p.do(httptest.NewRequest(route.method, route.path, nil))
		if answer.Code != http.StatusUnauthorized {
			t.Errorf("%s %s: %d", route.method, route.path, answer.Code)
		}
	}
}

func TestASessionOpensTheAPI(t *testing.T) {
	p := newPlatform(t, stubGitHub{})
	request := httptest.NewRequest(http.MethodGet, "/runs", nil)
	request.AddCookie(p.signIn())
	if answer := p.do(request); answer.Code != http.StatusOK {
		t.Fatalf("status %d: %s", answer.Code, answer.Body)
	}
}

func TestTheServiceTokenOpensTheAPI(t *testing.T) {
	p := newPlatform(t, stubGitHub{})
	request := httptest.NewRequest(http.MethodGet, "/runs", nil)
	request.Header.Set("Authorization", "Bearer "+serviceToken)
	if answer := p.do(request); answer.Code != http.StatusOK {
		t.Fatalf("status %d", answer.Code)
	}
	request.Header.Set("Authorization", "Bearer wrong")
	if answer := p.do(request); answer.Code != http.StatusUnauthorized {
		t.Fatalf("wrong token: %d", answer.Code)
	}
}

func TestADatabaseFailureIsUnavailableNotOpen(t *testing.T) {
	p := newPlatform(t, stubGitHub{})
	session := p.signIn()
	p.store.down = true
	request := httptest.NewRequest(http.MethodGet, "/runs", nil)
	request.AddCookie(session)
	if answer := p.do(request); answer.Code != http.StatusServiceUnavailable {
		t.Fatalf("status %d", answer.Code)
	}
}

func TestMeDescribesTheSignedInUser(t *testing.T) {
	p := newPlatform(t, stubGitHub{})
	request := httptest.NewRequest(http.MethodGet, "/me", nil)
	request.AddCookie(p.signIn())
	answer := p.do(request)
	var me map[string]any
	json.NewDecoder(answer.Body).Decode(&me)
	if answer.Code != http.StatusOK || me["login"] != "octocat" || me["avatar_url"] != "https://avatars.test/1" || me["credits"] != float64(5) || me["plan"] != "run_pack" {
		t.Fatalf("status %d, me %v", answer.Code, me)
	}
}

func TestTheServiceHasNoUser(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/me", nil)
	request.Header.Set("Authorization", "Bearer "+serviceToken)
	if answer := newPlatform(t, stubGitHub{}).do(request); answer.Code != http.StatusForbidden {
		t.Fatalf("status %d", answer.Code)
	}
}

func TestLogoutEndsTheSessionAndClearsTheCookie(t *testing.T) {
	p := newPlatform(t, stubGitHub{})
	session := p.signIn()
	logout := httptest.NewRequest(http.MethodPost, "/auth/logout", nil)
	logout.AddCookie(session)
	answer := p.do(logout)
	if answer.Code != http.StatusNoContent {
		t.Fatalf("status %d", answer.Code)
	}
	if cleared := cookieNamed(answer, "infrared_session"); cleared == nil || cleared.MaxAge >= 0 {
		t.Fatalf("cookie not cleared: %+v", cleared)
	}
	after := httptest.NewRequest(http.MethodGet, "/runs", nil)
	after.AddCookie(session)
	if answer := p.do(after); answer.Code != http.StatusUnauthorized {
		t.Fatalf("after logout: %d", answer.Code)
	}
}

func TestLogoutWithoutASessionIsStillNoContent(t *testing.T) {
	if answer := newPlatform(t, stubGitHub{}).do(httptest.NewRequest(http.MethodPost, "/auth/logout", nil)); answer.Code != http.StatusNoContent {
		t.Fatalf("status %d", answer.Code)
	}
}

func TestAPreflightIsAnsweredBeforeAuthentication(t *testing.T) {
	request := httptest.NewRequest(http.MethodOptions, "/runs", nil)
	request.Header.Set("Origin", dashboard)
	request.Header.Set("Access-Control-Request-Method", http.MethodGet)
	answer := newPlatform(t, stubGitHub{}).do(request)
	if answer.Code != http.StatusNoContent || answer.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatalf("status %d, headers %v", answer.Code, answer.Header())
	}
}

func TestAnHTTPSDashboardGetsSecureCookies(t *testing.T) {
	store := &memoryStore{sessions: map[string]auth.User{}}
	service := auth.NewService(store, stubGitHub{}, serviceToken, time.Now)
	handler := httpapi.AuthenticatedHandler(&fakeRuns{}, service, httpapi.AuthOptions{DashboardURL: "https://infrared.example.com/app"})
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/auth/github", nil))
	if state := cookieNamed(recorder, "infrared_oauth_state"); state == nil || !state.Secure {
		t.Fatalf("state cookie %+v", state)
	}
}

func pollWith(p *platform, device *http.Cookie) (*httptest.ResponseRecorder, string) {
	request := httptest.NewRequest(http.MethodPost, "/auth/device/poll", nil)
	if device != nil {
		request.AddCookie(device)
	}
	answer := p.do(request)
	var body map[string]string
	json.NewDecoder(answer.Body).Decode(&body)
	return answer, body["status"]
}

func TestADeviceSignInShowsTheCodeAndKeepsTheDeviceCodeInACookie(t *testing.T) {
	answer := newPlatform(t, stubGitHub{}).do(httptest.NewRequest(http.MethodPost, "/auth/device", nil))
	var body map[string]any
	json.NewDecoder(answer.Body).Decode(&body)
	if answer.Code != http.StatusOK || body["user_code"] != "WDJB-MJHT" || body["verification_uri"] != "https://github.com/login/device" || body["interval"] != float64(5) {
		t.Fatalf("status %d, body %v", answer.Code, body)
	}
	if _, leaked := body["device_code"]; leaked {
		t.Fatal("the device code reached the browser")
	}
	device := cookieNamed(answer, "infrared_device")
	if device == nil || device.Value != "device-secret" || !device.HttpOnly || device.SameSite != http.SameSiteStrictMode || device.Path != "/auth/device" || device.MaxAge != 900 {
		t.Fatalf("device cookie %+v", device)
	}
}

func TestAnApprovedDeviceCodeSignsIn(t *testing.T) {
	p := newPlatform(t, stubGitHub{})
	device := cookieNamed(p.do(httptest.NewRequest(http.MethodPost, "/auth/device", nil)), "infrared_device")
	answer, status := pollWith(p, device)
	if status != "signed_in" {
		t.Fatalf("status %q", status)
	}
	session := cookieNamed(answer, "infrared_session")
	if session == nil || session.SameSite != http.SameSiteStrictMode {
		t.Fatalf("session cookie %+v", session)
	}
	me := httptest.NewRequest(http.MethodGet, "/me", nil)
	me.AddCookie(session)
	if p.do(me).Code != http.StatusOK {
		t.Fatal("the new session does not open /me")
	}
}

func TestDeviceCodeStatesPassThrough(t *testing.T) {
	for want, pollErr := range map[string]error{"pending": auth.ErrPending, "slow_down": auth.ErrSlowDown, "expired": auth.ErrExpired, "denied": auth.ErrDenied} {
		p := newPlatform(t, stubGitHub{pollErr: pollErr})
		answer, status := pollWith(p, &http.Cookie{Name: "infrared_device", Value: "device-secret"})
		if status != want || cookieNamed(answer, "infrared_session") != nil {
			t.Errorf("%s: got %q", want, status)
		}
	}
}

func TestPollingWithoutTheDeviceCookieSaysSoInsteadOfExpired(t *testing.T) {
	if _, status := pollWith(newPlatform(t, stubGitHub{}), nil); status != "no_cookie" {
		t.Fatalf("status %q", status)
	}
}

func TestDeviceFlowFailuresAreGatewayErrors(t *testing.T) {
	start := newPlatform(t, stubGitHub{err: errors.New("device_flow_disabled")}).do(httptest.NewRequest(http.MethodPost, "/auth/device", nil))
	if start.Code != http.StatusBadGateway {
		t.Fatalf("start: %d", start.Code)
	}
	answer, _ := pollWith(newPlatform(t, stubGitHub{pollErr: errors.New("timeout")}), &http.Cookie{Name: "infrared_device", Value: "d"})
	if answer.Code != http.StatusBadGateway {
		t.Fatalf("poll: %d", answer.Code)
	}
}
