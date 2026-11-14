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
	t.Setenv("ORCHESTRATOR_COMPANY", "")
	t.Setenv("ORCHESTRATOR_ADDR", "127.0.0.1:8080")
	t.Setenv("ORCHESTRATOR_AUTH", "off")
}

var authRequired = []string{
	"ORCHESTRATOR_DATABASE_URL", "GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET", "ORCHESTRATOR_SERVICE_TOKEN", "ORCHESTRATOR_DASHBOARD_URL",
}

func setAuth(t *testing.T) {
	setAll(t)
	t.Setenv("ORCHESTRATOR_AUTH", "")
	t.Setenv("ORCHESTRATOR_DATABASE_URL", "postgres://infrared@127.0.0.1:54330/infrared")
	t.Setenv("GITHUB_APP_CLIENT_ID", "Iv-client")
	t.Setenv("GITHUB_APP_CLIENT_SECRET", "secret")
	t.Setenv("ORCHESTRATOR_SERVICE_TOKEN", strings.Repeat("s", 32))
	t.Setenv("ORCHESTRATOR_DASHBOARD_URL", "http://127.0.0.1:5173/app/")
}

func TestAuthIsOnByDefaultAndReadsItsSettings(t *testing.T) {
	setAuth(t)
	loaded, err := settings.Load()
	if err != nil {
		t.Fatal(err)
	}
	if !loaded.Auth.Enabled || loaded.Auth.ClientID != "Iv-client" || loaded.Auth.DashboardURL != "http://127.0.0.1:5173/app" || loaded.Auth.ServiceToken != strings.Repeat("s", 32) {
		t.Fatalf("auth %+v", loaded.Auth)
	}
}

func TestAuthOnNamesEveryMissingVariable(t *testing.T) {
	setAuth(t)
	for _, name := range authRequired {
		t.Setenv(name, "")
	}
	_, err := settings.Load()
	if err == nil {
		t.Fatal("started without the auth settings")
	}
	for _, name := range authRequired {
		if !strings.Contains(err.Error(), name) {
			t.Errorf("%s is not named: %v", name, err)
		}
	}
}

func TestAShortServiceTokenStopsStartup(t *testing.T) {
	setAuth(t)
	t.Setenv("ORCHESTRATOR_SERVICE_TOKEN", strings.Repeat("s", 31))
	if _, err := settings.Load(); err == nil || !strings.Contains(err.Error(), "ORCHESTRATOR_SERVICE_TOKEN") {
		t.Fatalf("short token: %v", err)
	}
}

func TestAuthOffNeedsNothingElseOnLoopback(t *testing.T) {
	for _, addr := range []string{"127.0.0.1:8080", "localhost:8080", "[::1]:8080"} {
		setAll(t)
		t.Setenv("ORCHESTRATOR_ADDR", addr)
		loaded, err := settings.Load()
		if err != nil || loaded.Auth.Enabled {
			t.Errorf("%s: enabled %v, error %v", addr, loaded.Auth.Enabled, err)
		}
	}
}

func TestAuthOffIsRefusedOffLoopback(t *testing.T) {
	for _, addr := range []string{"0.0.0.0:8080", ":8080", "10.0.0.5:8080"} {
		setAll(t)
		t.Setenv("ORCHESTRATOR_ADDR", addr)
		if _, err := settings.Load(); err == nil || !strings.Contains(err.Error(), "ORCHESTRATOR_AUTH=off") {
			t.Errorf("%s: %v", addr, err)
		}
	}
}

func TestAnUnknownAuthModeStopsStartup(t *testing.T) {
	setAll(t)
	t.Setenv("ORCHESTRATOR_AUTH", "maybe")
	if _, err := settings.Load(); err == nil || !strings.Contains(err.Error(), "ORCHESTRATOR_AUTH") {
		t.Fatalf("unknown mode: %v", err)
	}
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

func TestAllowedOriginsAreOptionalAndCommaSeparated(t *testing.T) {
	setAll(t)
	t.Setenv("ORCHESTRATOR_ALLOWED_ORIGINS", "")
	loaded, err := settings.Load()
	if err != nil || len(loaded.AllowedOrigins) != 0 {
		t.Fatalf("unset: %v %q", err, loaded.AllowedOrigins)
	}
	t.Setenv("ORCHESTRATOR_ALLOWED_ORIGINS", " http://127.0.0.1:5173 , http://localhost:5173,")
	loaded, err = settings.Load()
	if err != nil || strings.Join(loaded.AllowedOrigins, "|") != "http://127.0.0.1:5173|http://localhost:5173" {
		t.Fatalf("set: %v %q", err, loaded.AllowedOrigins)
	}
}

func TestTheCompanyDefaultsToCompanyAndMustBeAProjectID(t *testing.T) {
	setAll(t)
	loaded, err := settings.Load()
	if err != nil || loaded.Workflow.Company != "company" {
		t.Fatalf("unset: %v %q", err, loaded.Workflow.Company)
	}
	t.Setenv("ORCHESTRATOR_COMPANY", " northwind ")
	loaded, err = settings.Load()
	if err != nil || loaded.Workflow.Company != "northwind" {
		t.Fatalf("set: %v %q", err, loaded.Workflow.Company)
	}
	t.Setenv("ORCHESTRATOR_COMPANY", "../etc")
	if _, err := settings.Load(); err == nil || !strings.Contains(err.Error(), "ORCHESTRATOR_COMPANY") {
		t.Fatalf("a path as the company: %v", err)
	}
}
