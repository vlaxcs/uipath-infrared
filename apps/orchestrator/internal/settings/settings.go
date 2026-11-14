package settings

import (
	"fmt"
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
}

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
	settings.AllowedOrigins = optionalList("ORCHESTRATOR_ALLOWED_ORIGINS")
	return settings, nil
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
