package github_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"infrared/orchestrator/internal/adapters/github"
	"infrared/orchestrator/internal/auth"
)

type fakeGitHub struct {
	tokenAnswer   map[string]any
	userStatus    int
	userAnswer    map[string]any
	exchanged     url.Values
	authorization string
}

func (f *fakeGitHub) server(t *testing.T) *httptest.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /login/oauth/access_token", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Accept") != "application/json" {
			t.Errorf("accept %q", r.Header.Get("Accept"))
		}
		r.ParseForm()
		f.exchanged = r.PostForm
		json.NewEncoder(w).Encode(f.tokenAnswer)
	})
	mux.HandleFunc("GET /user", func(w http.ResponseWriter, r *http.Request) {
		f.authorization = r.Header.Get("Authorization")
		w.WriteHeader(f.userStatus)
		json.NewEncoder(w).Encode(f.userAnswer)
	})
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server
}

func client(server *httptest.Server) *github.OAuth {
	return github.NewOAuth(github.OAuthConfig{
		ClientID:     "Iv-client",
		ClientSecret: "the-secret",
		WebURL:       server.URL,
		APIURL:       server.URL,
		HTTP:         server.Client(),
	})
}

func TestTheAuthorizeURLCarriesTheClientAndTheState(t *testing.T) {
	authorize, err := url.Parse(github.NewOAuth(github.OAuthConfig{ClientID: "Iv-client"}).AuthorizeURL("st/ate"))
	if err != nil {
		t.Fatal(err)
	}
	if authorize.Scheme+"://"+authorize.Host+authorize.Path != "https://github.com/login/oauth/authorize" {
		t.Fatalf("url %s", authorize)
	}
	query := authorize.Query()
	if query.Get("client_id") != "Iv-client" || query.Get("state") != "st/ate" || query.Has("redirect_uri") {
		t.Fatalf("query %v", query)
	}
}

func TestIdentifyExchangesTheCodeAndReadsTheUser(t *testing.T) {
	fake := &fakeGitHub{
		tokenAnswer: map[string]any{"access_token": "ghu_user", "token_type": "bearer"},
		userStatus:  http.StatusOK,
		userAnswer:  map[string]any{"id": 583231, "login": "octocat", "avatar_url": "https://avatars.test/u/583231"},
	}
	identity, err := client(fake.server(t)).Identify(context.Background(), "the-code")
	if err != nil {
		t.Fatal(err)
	}
	if identity != (auth.Identity{GithubID: 583231, Login: "octocat", AvatarURL: "https://avatars.test/u/583231"}) {
		t.Fatalf("identity %+v", identity)
	}
	if fake.exchanged.Get("client_id") != "Iv-client" || fake.exchanged.Get("client_secret") != "the-secret" || fake.exchanged.Get("code") != "the-code" {
		t.Fatalf("exchange form %v", fake.exchanged)
	}
	if fake.authorization != "Bearer ghu_user" {
		t.Fatalf("authorization %q", fake.authorization)
	}
}

func TestARejectedCodeIsAnError(t *testing.T) {
	fake := &fakeGitHub{tokenAnswer: map[string]any{"error": "bad_verification_code", "error_description": "The code passed is incorrect or expired."}}
	_, err := client(fake.server(t)).Identify(context.Background(), "stale")
	if err == nil || !strings.Contains(err.Error(), "bad_verification_code") {
		t.Fatalf("error %v", err)
	}
	if fake.authorization != "" {
		t.Fatal("read the user without a token")
	}
}

func TestAFailedUserReadIsAnError(t *testing.T) {
	fake := &fakeGitHub{tokenAnswer: map[string]any{"access_token": "ghu_user"}, userStatus: http.StatusUnauthorized, userAnswer: map[string]any{"message": "Bad credentials"}}
	if _, err := client(fake.server(t)).Identify(context.Background(), "code"); err == nil || !strings.Contains(err.Error(), "401") {
		t.Fatalf("error %v", err)
	}
}

func TestAUserWithoutAnIDIsAnError(t *testing.T) {
	fake := &fakeGitHub{tokenAnswer: map[string]any{"access_token": "ghu_user"}, userStatus: http.StatusOK, userAnswer: map[string]any{"login": "ghost"}}
	if _, err := client(fake.server(t)).Identify(context.Background(), "code"); err == nil {
		t.Fatal("accepted a user without an id")
	}
}

func deviceServer(t *testing.T, codeAnswer, tokenAnswer map[string]any) (*httptest.Server, *url.Values) {
	polled := &url.Values{}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /login/device/code", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(codeAnswer)
	})
	mux.HandleFunc("POST /login/oauth/access_token", func(w http.ResponseWriter, r *http.Request) {
		r.ParseForm()
		*polled = r.PostForm
		json.NewEncoder(w).Encode(tokenAnswer)
	})
	mux.HandleFunc("GET /user", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"id": 7, "login": "robi", "avatar_url": "https://avatars.test/7"})
	})
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server, polled
}

func TestStartDeviceReadsTheCodes(t *testing.T) {
	server, _ := deviceServer(t, map[string]any{"device_code": "dc", "user_code": "WDJB-MJHT", "verification_uri": "https://github.com/login/device", "expires_in": 900, "interval": 5}, nil)
	code, err := client(server).StartDevice(context.Background())
	if err != nil || code != (auth.DeviceCode{DeviceCode: "dc", UserCode: "WDJB-MJHT", VerificationURI: "https://github.com/login/device", ExpiresIn: 900, Interval: 5}) {
		t.Fatalf("code %+v, error %v", code, err)
	}
}

func TestStartDeviceFailsWhenDeviceFlowIsOff(t *testing.T) {
	server, _ := deviceServer(t, map[string]any{"error": "device_flow_disabled"}, nil)
	if _, err := client(server).StartDevice(context.Background()); err == nil || !strings.Contains(err.Error(), "device_flow_disabled") {
		t.Fatalf("error %v", err)
	}
}

func TestPollDeviceMapsGitHubsAnswers(t *testing.T) {
	for answer, want := range map[string]error{"authorization_pending": auth.ErrPending, "slow_down": auth.ErrSlowDown, "expired_token": auth.ErrExpired, "access_denied": auth.ErrDenied} {
		server, polled := deviceServer(t, nil, map[string]any{"error": answer})
		if _, err := client(server).PollDevice(context.Background(), "dc"); !errors.Is(err, want) {
			t.Errorf("%s: %v", answer, err)
		}
		if polled.Get("grant_type") != "urn:ietf:params:oauth:grant-type:device_code" || polled.Get("device_code") != "dc" || polled.Has("client_secret") {
			t.Errorf("%s: form %v", answer, polled)
		}
	}
}

func TestAnApprovedDeviceCodeReadsTheUser(t *testing.T) {
	server, _ := deviceServer(t, nil, map[string]any{"access_token": "ghu_device"})
	identity, err := client(server).PollDevice(context.Background(), "dc")
	if err != nil || identity.Login != "robi" || identity.GithubID != 7 {
		t.Fatalf("identity %+v, error %v", identity, err)
	}
}
