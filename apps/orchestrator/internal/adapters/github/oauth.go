package github

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"infrared/orchestrator/internal/auth"
)

const (
	defaultWebURL = "https://github.com"
	defaultAPIURL = "https://api.github.com"
	maxAnswer     = 1 << 20
)

type OAuthConfig struct {
	ClientID     string
	ClientSecret string
	WebURL       string
	APIURL       string
	HTTP         *http.Client
}

type OAuth struct {
	config OAuthConfig
}

func NewOAuth(config OAuthConfig) *OAuth {
	if config.WebURL == "" {
		config.WebURL = defaultWebURL
	}
	if config.APIURL == "" {
		config.APIURL = defaultAPIURL
	}
	if config.HTTP == nil {
		config.HTTP = &http.Client{Timeout: 10 * time.Second}
	}
	return &OAuth{config: config}
}

func (o *OAuth) AuthorizeURL(state string) string {
	query := url.Values{"client_id": {o.config.ClientID}, "state": {state}}
	return o.config.WebURL + "/login/oauth/authorize?" + query.Encode()
}

func (o *OAuth) Identify(ctx context.Context, code string) (auth.Identity, error) {
	token, err := o.exchange(ctx, code)
	if err != nil {
		return auth.Identity{}, err
	}
	return o.user(ctx, token)
}

func (o *OAuth) StartDevice(ctx context.Context) (auth.DeviceCode, error) {
	var answer struct {
		DeviceCode      string `json:"device_code"`
		UserCode        string `json:"user_code"`
		VerificationURI string `json:"verification_uri"`
		ExpiresIn       int    `json:"expires_in"`
		Interval        int    `json:"interval"`
		Error           string `json:"error"`
		Description     string `json:"error_description"`
	}
	if err := o.postForm(ctx, "/login/device/code", url.Values{"client_id": {o.config.ClientID}}, &answer); err != nil {
		return auth.DeviceCode{}, fmt.Errorf("device code: %w", err)
	}
	if answer.Error != "" {
		return auth.DeviceCode{}, fmt.Errorf("device code: %s: %s", answer.Error, answer.Description)
	}
	if answer.DeviceCode == "" || answer.UserCode == "" {
		return auth.DeviceCode{}, fmt.Errorf("device code: GitHub sent no code")
	}
	return auth.DeviceCode{
		DeviceCode:      answer.DeviceCode,
		UserCode:        answer.UserCode,
		VerificationURI: answer.VerificationURI,
		ExpiresIn:       answer.ExpiresIn,
		Interval:        answer.Interval,
	}, nil
}

var deviceErrors = map[string]error{
	"authorization_pending": auth.ErrPending,
	"slow_down":             auth.ErrSlowDown,
	"expired_token":         auth.ErrExpired,
	"access_denied":         auth.ErrDenied,
}

func (o *OAuth) PollDevice(ctx context.Context, deviceCode string) (auth.Identity, error) {
	form := url.Values{
		"client_id":   {o.config.ClientID},
		"device_code": {deviceCode},
		"grant_type":  {"urn:ietf:params:oauth:grant-type:device_code"},
	}
	var answer tokenAnswer
	if err := o.postForm(ctx, "/login/oauth/access_token", form, &answer); err != nil {
		return auth.Identity{}, fmt.Errorf("device token: %w", err)
	}
	if known, found := deviceErrors[answer.Error]; found {
		return auth.Identity{}, known
	}
	if answer.Error != "" {
		return auth.Identity{}, fmt.Errorf("device token: %s: %s", answer.Error, answer.Description)
	}
	if answer.AccessToken == "" {
		return auth.Identity{}, fmt.Errorf("device token: no access token")
	}
	return o.user(ctx, answer.AccessToken)
}

type tokenAnswer struct {
	AccessToken string `json:"access_token"`
	Error       string `json:"error"`
	Description string `json:"error_description"`
}

func (o *OAuth) postForm(ctx context.Context, path string, form url.Values, into any) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, o.config.WebURL+path, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	request.Header.Set("Accept", "application/json")
	return o.do(request, into)
}

func (o *OAuth) exchange(ctx context.Context, code string) (string, error) {
	form := url.Values{"client_id": {o.config.ClientID}, "client_secret": {o.config.ClientSecret}, "code": {code}}
	var answer struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		Description string `json:"error_description"`
	}
	if err := o.postForm(ctx, "/login/oauth/access_token", form, &answer); err != nil {
		return "", fmt.Errorf("code exchange: %w", err)
	}
	if answer.Error != "" {
		return "", fmt.Errorf("code exchange: %s: %s", answer.Error, answer.Description)
	}
	if answer.AccessToken == "" {
		return "", fmt.Errorf("code exchange: no access token")
	}
	return answer.AccessToken, nil
}

func (o *OAuth) user(ctx context.Context, token string) (auth.Identity, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, o.config.APIURL+"/user", nil)
	if err != nil {
		return auth.Identity{}, err
	}
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	var answer struct {
		ID        int64  `json:"id"`
		Login     string `json:"login"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := o.do(request, &answer); err != nil {
		return auth.Identity{}, fmt.Errorf("read user: %w", err)
	}
	if answer.ID <= 0 || answer.Login == "" {
		return auth.Identity{}, fmt.Errorf("read user: no id or login")
	}
	return auth.Identity{GithubID: answer.ID, Login: answer.Login, AvatarURL: answer.AvatarURL}, nil
}

func (o *OAuth) do(request *http.Request, into any) error {
	request.Header.Set("User-Agent", "infrared-orchestrator")
	response, err := o.config.HTTP.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, maxAnswer))
	if err != nil {
		return err
	}
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("GitHub answered %d", response.StatusCode)
	}
	return json.Unmarshal(body, into)
}
