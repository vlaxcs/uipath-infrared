package auth_test

import (
	"bytes"
	"context"
	"errors"
	"testing"
	"time"

	"infrared/orchestrator/internal/auth"
)

const serviceToken = "service-token-that-is-at-least-32-chars"

var now = time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)

type session struct {
	user    auth.User
	expires time.Time
}

type fakeStore struct {
	users    map[int64]auth.User
	sessions map[string]session
	down     bool
}

func newStore() *fakeStore {
	return &fakeStore{users: map[int64]auth.User{}, sessions: map[string]session{}}
}

func (s *fakeStore) SignIn(_ context.Context, identity auth.Identity, tokenHash []byte, expiresAt time.Time) error {
	if s.down {
		return errors.New("connection refused")
	}
	user, found := s.users[identity.GithubID]
	if !found {
		user = auth.User{ID: int64(len(s.users) + 1), Credits: 5}
	}
	user.Login, user.AvatarURL = identity.Login, identity.AvatarURL
	s.users[identity.GithubID] = user
	s.sessions[string(tokenHash)] = session{user: user, expires: expiresAt}
	return nil
}

func (s *fakeStore) UserBySession(_ context.Context, tokenHash []byte, at time.Time) (auth.User, error) {
	if s.down {
		return auth.User{}, errors.New("connection refused")
	}
	found, ok := s.sessions[string(tokenHash)]
	if !ok || !found.expires.After(at) {
		return auth.User{}, auth.ErrNoSession
	}
	return found.user, nil
}

func (s *fakeStore) EndSession(_ context.Context, tokenHash []byte) error {
	delete(s.sessions, string(tokenHash))
	return nil
}

func (s *fakeStore) DeleteExpired(context.Context, time.Time) (int64, error) { return 0, nil }

type fakeGitHub struct {
	identity auth.Identity
	err      error
	codes    []string
	pollErr  error
}

func (g *fakeGitHub) StartDevice(context.Context) (auth.DeviceCode, error) {
	return auth.DeviceCode{DeviceCode: "device", UserCode: "WDJB-MJHT", VerificationURI: "https://github.com/login/device", ExpiresIn: 900, Interval: 5}, g.err
}

func (g *fakeGitHub) PollDevice(context.Context, string) (auth.Identity, error) {
	return g.identity, g.pollErr
}

func (g *fakeGitHub) AuthorizeURL(state string) string {
	return "https://github.test/authorize?state=" + state
}

func (g *fakeGitHub) Identify(_ context.Context, code string) (auth.Identity, error) {
	g.codes = append(g.codes, code)
	return g.identity, g.err
}

func newService(store *fakeStore, github *fakeGitHub) *auth.Service {
	return auth.NewService(store, github, serviceToken, func() time.Time { return now })
}

var octocat = auth.Identity{GithubID: 583231, Login: "octocat", AvatarURL: "https://avatars.test/583231"}

func TestSigningInOpensASessionThatAuthenticatesTheUser(t *testing.T) {
	store, github := newStore(), &fakeGitHub{identity: octocat}
	service := newService(store, github)

	token, err := service.SignIn(context.Background(), "the-code")
	if err != nil {
		t.Fatal(err)
	}
	if len(github.codes) != 1 || github.codes[0] != "the-code" {
		t.Fatalf("codes sent to GitHub: %q", github.codes)
	}
	principal, err := service.Authenticate(context.Background(), "", token)
	if err != nil {
		t.Fatal(err)
	}
	if principal.User == nil || principal.User.Login != "octocat" || principal.Service {
		t.Fatalf("principal %+v", principal)
	}
}

func TestTheStoreNeverSeesTheSessionToken(t *testing.T) {
	store := newStore()
	token, err := newService(store, &fakeGitHub{identity: octocat}).SignIn(context.Background(), "code")
	if err != nil {
		t.Fatal(err)
	}
	for hash := range store.sessions {
		if bytes.Contains([]byte(hash), []byte(token)) {
			t.Fatal("the store holds the raw token")
		}
		if !bytes.Equal([]byte(hash), auth.Hash(token)) {
			t.Fatal("the store holds something other than the token's hash")
		}
	}
}

func TestEverySignInGetsADifferentToken(t *testing.T) {
	service := newService(newStore(), &fakeGitHub{identity: octocat})
	first, _ := service.SignIn(context.Background(), "code")
	second, _ := service.SignIn(context.Background(), "code")
	if first == second || len(first) < 43 {
		t.Fatalf("tokens %q and %q", first, second)
	}
}

func TestASessionLastsThirtyDays(t *testing.T) {
	store := newStore()
	if _, err := newService(store, &fakeGitHub{identity: octocat}).SignIn(context.Background(), "code"); err != nil {
		t.Fatal(err)
	}
	for _, opened := range store.sessions {
		if !opened.expires.Equal(now.Add(30 * 24 * time.Hour)) {
			t.Fatalf("expires %v", opened.expires)
		}
	}
}

func TestAGitHubFailureOpensNoSession(t *testing.T) {
	store := newStore()
	_, err := newService(store, &fakeGitHub{err: errors.New("bad_verification_code")}).SignIn(context.Background(), "code")
	if !errors.Is(err, auth.ErrGitHub) {
		t.Fatalf("error %v", err)
	}
	if len(store.sessions) != 0 {
		t.Fatal("a session was opened")
	}
}

func TestTheServiceTokenAuthenticatesAsTheService(t *testing.T) {
	principal, err := newService(newStore(), &fakeGitHub{}).Authenticate(context.Background(), serviceToken, "")
	if err != nil || !principal.Service || principal.User != nil {
		t.Fatalf("principal %+v, error %v", principal, err)
	}
}

func TestAWrongServiceTokenIsRejected(t *testing.T) {
	service := newService(newStore(), &fakeGitHub{})
	for _, bearer := range []string{"nope", serviceToken + "x", serviceToken[:31]} {
		if _, err := service.Authenticate(context.Background(), bearer, ""); !errors.Is(err, auth.ErrNoSession) {
			t.Errorf("bearer %q: %v", bearer, err)
		}
	}
}

func TestNoCredentialsIsNoSession(t *testing.T) {
	if _, err := newService(newStore(), &fakeGitHub{}).Authenticate(context.Background(), "", ""); !errors.Is(err, auth.ErrNoSession) {
		t.Fatalf("error %v", err)
	}
}

func TestAnUnknownSessionIsNoSession(t *testing.T) {
	if _, err := newService(newStore(), &fakeGitHub{}).Authenticate(context.Background(), "", "made-up"); !errors.Is(err, auth.ErrNoSession) {
		t.Fatalf("error %v", err)
	}
}

func TestADatabaseFailureIsUnavailableNotNoSession(t *testing.T) {
	store := newStore()
	store.down = true
	_, err := newService(store, &fakeGitHub{}).Authenticate(context.Background(), "", "token")
	if !errors.Is(err, auth.ErrUnavailable) || errors.Is(err, auth.ErrNoSession) {
		t.Fatalf("error %v", err)
	}
}

func TestSigningOutEndsTheSession(t *testing.T) {
	service := newService(newStore(), &fakeGitHub{identity: octocat})
	token, _ := service.SignIn(context.Background(), "code")
	if err := service.SignOut(context.Background(), token); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Authenticate(context.Background(), "", token); !errors.Is(err, auth.ErrNoSession) {
		t.Fatalf("after sign-out: %v", err)
	}
}

func TestStatesAreRandomAndURLSafe(t *testing.T) {
	service := newService(newStore(), &fakeGitHub{})
	first, err := service.NewState()
	if err != nil {
		t.Fatal(err)
	}
	second, _ := service.NewState()
	if first == second || len(first) < 43 || bytes.ContainsAny([]byte(first), "+/=") {
		t.Fatalf("states %q and %q", first, second)
	}
}

func TestAnApprovedDeviceCodeOpensASession(t *testing.T) {
	service := newService(newStore(), &fakeGitHub{identity: octocat})
	token, err := service.PollDevice(context.Background(), "device")
	if err != nil {
		t.Fatal(err)
	}
	principal, err := service.Authenticate(context.Background(), "", token)
	if err != nil || principal.User.Login != "octocat" {
		t.Fatalf("principal %+v, error %v", principal, err)
	}
}

func TestADeviceCodeNotApprovedYetOpensNoSession(t *testing.T) {
	for _, waiting := range []error{auth.ErrPending, auth.ErrSlowDown, auth.ErrExpired, auth.ErrDenied} {
		store := newStore()
		_, err := newService(store, &fakeGitHub{pollErr: waiting}).PollDevice(context.Background(), "device")
		if !errors.Is(err, waiting) || len(store.sessions) != 0 {
			t.Errorf("%v: error %v, sessions %d", waiting, err, len(store.sessions))
		}
	}
}

func TestAFailedDeviceCheckIsAGitHubError(t *testing.T) {
	_, err := newService(newStore(), &fakeGitHub{pollErr: errors.New("timeout")}).PollDevice(context.Background(), "device")
	if !errors.Is(err, auth.ErrGitHub) {
		t.Fatalf("error %v", err)
	}
}
