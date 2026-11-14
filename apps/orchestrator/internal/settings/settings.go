package settings

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/joho/godotenv"

	"infrared/orchestrator/internal/workflow"
)

const defaultMaxRevisions = 2

type Settings struct {
	Addr           string
	RunsDir        string
	ContractsDir   string
	AllowedOrigins []string
	Workflow       workflow.Config
	Auth           Auth
}

type Auth struct {
	Enabled      bool
	DatabaseURL  string
	ClientID     string
	ClientSecret string
	ServiceToken string
	DashboardURL string
}

const minServiceToken = 32

const defaultFlociURL = "http://localhost:4566"

func Load() (Settings, error) {
	loadDotEnv()
	missing := []string{}
	value := func(name string) string {
		found := strings.TrimSpace(os.Getenv(name))
		if found == "" {
			missing = append(missing, name)
		}
		return found
	}
	settings := Settings{
		Addr:         value("ORCHESTRATOR_ADDR"),
		RunsDir:      value("ORCHESTRATOR_RUNS_DIR"),
		ContractsDir: value("ORCHESTRATOR_CONTRACTS_DIR"),
		Workflow: workflow.Config{
			ProjectsDir: value("ORCHESTRATOR_PROJECTS_DIR"),
			CatalogPath: value("ORCHESTRATOR_CATALOG"),
			Commands: workflow.Commands{
				Extract: strings.Fields(value("ORCHESTRATOR_EXTRACT_CMD")),
				Agent:   strings.Fields(value("ORCHESTRATOR_AGENT_CMD")),
				Engine:  strings.Fields(value("ORCHESTRATOR_ENGINE_CMD")),
				Sandbox: strings.Fields(value("ORCHESTRATOR_SANDBOX_CMD")),
				States:  strings.Fields(os.Getenv("ORCHESTRATOR_STATES_CMD")),
			},
			Timeouts: workflow.DefaultTimeouts,
		},
	}
	if len(missing) > 0 {
		return Settings{}, fmt.Errorf("%s is not set. Copy .env.example to .env at the repo root and fill it in", missing[0])
	}
	maxRevisions, err := optionalCount("ORCHESTRATOR_MAX_REVISIONS", defaultMaxRevisions)
	if err != nil {
		return Settings{}, err
	}
	settings.Workflow.MaxRevisions = maxRevisions
	settings.Workflow.FlociURL = strings.TrimSpace(os.Getenv("AWS_ENDPOINT_URL"))
	if settings.Workflow.FlociURL == "" {
		settings.Workflow.FlociURL = defaultFlociURL
	}
	settings.AllowedOrigins = optionalList("ORCHESTRATOR_ALLOWED_ORIGINS")
	auth, err := loadAuth(settings.Addr)
	if err != nil {
		return Settings{}, err
	}
	settings.Auth = auth
	return settings, nil
}

func loadAuth(addr string) (Auth, error) {
	switch mode := strings.TrimSpace(os.Getenv("ORCHESTRATOR_AUTH")); mode {
	case "off":
		if !onLoopback(addr) {
			return Auth{}, fmt.Errorf("ORCHESTRATOR_AUTH=off is only allowed when ORCHESTRATOR_ADDR is a loopback address, not %q", addr)
		}
		return Auth{}, nil
	case "", "on":
	default:
		return Auth{}, fmt.Errorf("ORCHESTRATOR_AUTH must be on or off, not %q", mode)
	}
	var missing []string
	value := func(name string) string {
		found := strings.TrimSpace(os.Getenv(name))
		if found == "" {
			missing = append(missing, name)
		}
		return found
	}
	auth := Auth{
		Enabled:      true,
		DatabaseURL:  value("ORCHESTRATOR_DATABASE_URL"),
		ClientID:     value("GITHUB_APP_CLIENT_ID"),
		ClientSecret: value("GITHUB_APP_CLIENT_SECRET"),
		ServiceToken: value("ORCHESTRATOR_SERVICE_TOKEN"),
		DashboardURL: strings.TrimRight(value("ORCHESTRATOR_DASHBOARD_URL"), "/"),
	}
	if len(missing) > 0 {
		verb := "are"
		if len(missing) == 1 {
			verb = "is"
		}
		return Auth{}, fmt.Errorf("sign-in is on and %s %s not set; set them, or ORCHESTRATOR_AUTH=off on a loopback address", strings.Join(missing, ", "), verb)
	}
	if len(auth.ServiceToken) < minServiceToken {
		return Auth{}, fmt.Errorf("ORCHESTRATOR_SERVICE_TOKEN must be at least %d characters", minServiceToken)
	}
	return auth, nil
}

func onLoopback(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return false
	}
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func optionalList(name string) []string {
	var items []string
	for _, item := range strings.Split(os.Getenv(name), ",") {
		if item = strings.TrimSpace(item); item != "" {
			items = append(items, item)
		}
	}
	return items
}

func optionalCount(name string, fallback int) (int, error) {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback, nil
	}
	count, err := strconv.Atoi(raw)
	if err != nil || count < 0 {
		return 0, fmt.Errorf("%s must be a non-negative integer", name)
	}
	return count, nil
}

func loadDotEnv() {
	dir, err := os.Getwd()
	if err != nil {
		return
	}
	for {
		candidate := filepath.Join(dir, ".env")
		if _, err := os.Stat(candidate); err == nil {
			godotenv.Load(candidate)
			return
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return
		}
		dir = parent
	}
}
