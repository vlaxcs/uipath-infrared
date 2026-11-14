package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"time"
)

const SessionLifetime = 30 * 24 * time.Hour

var (
	ErrNoSession   = errors.New("no session")
	ErrGitHub      = errors.New("github sign-in failed")
	ErrUnavailable = errors.New("sign-in store unavailable")

	ErrPending  = errors.New("device code not approved yet")
	ErrSlowDown = errors.New("polling the device code too fast")
	ErrExpired  = errors.New("device code expired")
	ErrDenied   = errors.New("device code denied")
)

type DeviceCode struct {
	DeviceCode      string
	UserCode        string
	VerificationURI string
	ExpiresIn       int
	Interval        int
}

type Identity struct {
	GithubID  int64
	Login     string
	AvatarURL string
}

type User struct {
	ID        int64
	Login     string
	AvatarURL string
	Credits   int
}

type Principal struct {
	User    *User
	Service bool
}

type Store interface {
	SignIn(ctx context.Context, identity Identity, tokenHash []byte, expiresAt time.Time) error
	UserBySession(ctx context.Context, tokenHash []byte, at time.Time) (User, error)
	EndSession(ctx context.Context, tokenHash []byte) error
	DeleteExpired(ctx context.Context, at time.Time) (int64, error)
}

type GitHub interface {
	AuthorizeURL(state string) string
	Identify(ctx context.Context, code string) (Identity, error)
	StartDevice(ctx context.Context) (DeviceCode, error)
	PollDevice(ctx context.Context, deviceCode string) (Identity, error)
}

type Service struct {
	store        Store
	github       GitHub
	serviceToken []byte
	now          func() time.Time
}

func NewService(store Store, github GitHub, serviceToken string, now func() time.Time) *Service {
	return &Service{store: store, github: github, serviceToken: []byte(serviceToken), now: now}
}

func Hash(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}

func (s *Service) NewState() (string, error) {
	return randomToken()
}

func (s *Service) AuthorizeURL(state string) string {
	return s.github.AuthorizeURL(state)
}

func (s *Service) SignIn(ctx context.Context, code string) (string, error) {
	identity, err := s.github.Identify(ctx, code)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrGitHub, err)
	}
	return s.openSession(ctx, identity)
}

func (s *Service) StartDevice(ctx context.Context) (DeviceCode, error) {
	code, err := s.github.StartDevice(ctx)
	if err != nil {
		return DeviceCode{}, fmt.Errorf("%w: %v", ErrGitHub, err)
	}
	return code, nil
}

func (s *Service) PollDevice(ctx context.Context, deviceCode string) (string, error) {
	identity, err := s.github.PollDevice(ctx, deviceCode)
	switch {
	case errors.Is(err, ErrPending), errors.Is(err, ErrSlowDown), errors.Is(err, ErrExpired), errors.Is(err, ErrDenied):
		return "", err
	case err != nil:
		return "", fmt.Errorf("%w: %v", ErrGitHub, err)
	}
	return s.openSession(ctx, identity)
}

func (s *Service) openSession(ctx context.Context, identity Identity) (string, error) {
	token, err := randomToken()
	if err != nil {
		return "", err
	}
	if err := s.store.SignIn(ctx, identity, Hash(token), s.now().Add(SessionLifetime)); err != nil {
		return "", fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	return token, nil
}

func (s *Service) Authenticate(ctx context.Context, bearer, sessionToken string) (Principal, error) {
	if bearer != "" {
		if subtle.ConstantTimeCompare([]byte(bearer), s.serviceToken) == 1 {
			return Principal{Service: true}, nil
		}
		return Principal{}, ErrNoSession
	}
	if sessionToken == "" {
		return Principal{}, ErrNoSession
	}
	user, err := s.store.UserBySession(ctx, Hash(sessionToken), s.now())
	if errors.Is(err, ErrNoSession) {
		return Principal{}, ErrNoSession
	}
	if err != nil {
		return Principal{}, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	return Principal{User: &user}, nil
}

func (s *Service) SignOut(ctx context.Context, sessionToken string) error {
	if sessionToken == "" {
		return nil
	}
	if err := s.store.EndSession(ctx, Hash(sessionToken)); err != nil {
		return fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	return nil
}

func (s *Service) DeleteExpired(ctx context.Context) (int64, error) {
	return s.store.DeleteExpired(ctx, s.now())
}

func randomToken() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}
