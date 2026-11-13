package settings_test

import (
	"strings"
	"testing"

	"infrared/orchestrator/internal/settings"
)

var required = []string{
	"ORCHESTRATOR_ADDR", "ORCHESTRATOR_RUNS_DIR", "ORCHESTRATOR_CONTRACTS_DIR", "ORCHESTRATOR_PROJECTS_DIR", "ORCHESTRATOR_CATALOG",
	"ORCHESTRATOR_EXTRACT_CMD", "ORCHESTRATOR_AGENT_CMD", "ORCHESTRATOR_ENGINE_CMD", "ORCHESTRATOR_SANDBOX_CMD",
}

func setAll(t *testing.T) {
	for _, name := range required {
		t.Setenv(name, "value for "+name)
	}
	t.Setenv("ORCHESTRATOR_MAX_REVISIONS", "")
}

func TestEveryRequiredVariableIsNamedWhenMissing(t *testing.T) {
	for _, name := range required {
		setAll(t)
		t.Setenv(name, " ")
		_, err := settings.Load()
		if err == nil || !strings.HasPrefix(err.Error(), name+" is not set") {
			t.Errorf("without %s: %v", name, err)
		}
	}
}

func TestCommandsSplitOnSpacesAndRevisionsDefaultToTwo(t *testing.T) {
	setAll(t)
	t.Setenv("ORCHESTRATOR_ENGINE_CMD", "python -m engine")
	loaded, err := settings.Load()
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(loaded.Workflow.Commands.Engine, "|") != "python|-m|engine" || loaded.Workflow.MaxRevisions != 2 {
		t.Fatalf("engine %q, max revisions %d", loaded.Workflow.Commands.Engine, loaded.Workflow.MaxRevisions)
	}
}

func TestABadRevisionCapStopsStartup(t *testing.T) {
	setAll(t)
	t.Setenv("ORCHESTRATOR_MAX_REVISIONS", "-1")
	if _, err := settings.Load(); err == nil || !strings.Contains(err.Error(), "ORCHESTRATOR_MAX_REVISIONS") {
		t.Fatalf("a negative cap: %v", err)
	}
}
