package workflow_test

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"testing"

	"infrared/orchestrator/internal/onboarding"
)

func decodeWithNumbers(t testing.TB, data []byte) map[string]any {
	t.Helper()
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	var document map[string]any
	if err := decoder.Decode(&document); err != nil {
		t.Fatal(err)
	}
	return document
}

func readFile(t testing.TB, path string) []byte {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func runDirs(t *testing.T, root string) []string {
	t.Helper()
	entries, err := os.ReadDir(root)
	if err != nil {
		t.Fatal(err)
	}
	names := []string{}
	for _, entry := range entries {
		names = append(names, entry.Name())
	}
	return names
}

func TestOnboardingAnswersLandInTheRunsForecastOnly(t *testing.T) {
	projects := projectsNamed(t, "startup")
	h := newHarness(t, options{maxRevisions: 2, projectsDir: projects})
	projectFile := filepath.Join(projects, "startup.forecast.json")
	before := readFile(t, projectFile)

	started, err := h.flow.Start("startup", &onboarding.Answers{Connection: onboarding.Floci, Targets: []string{"aws"}})
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(readFile(t, projectFile), before) {
		t.Fatal("the project's own forecast.json changed")
	}
	runForecast := readFile(t, filepath.Join(h.runsDir, started.ID, "forecast.json"))
	want := decodeWithNumbers(t, before)
	hard := want["hard_constraints"].(map[string]any)
	hard["allowed_providers"] = []any{"aws"}
	hard["forbidden_providers"] = []any{"managed_pg", "onprem"}
	if got := decodeWithNumbers(t, runForecast); !reflect.DeepEqual(got, want) {
		t.Fatalf("the run's forecast differs beyond the two provider lists:\n%s", runForecast)
	}
}

func TestWithoutAnswersTheRunsForecastIsTheProjectsByteForByte(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	started := h.start()
	project := readFile(t, filepath.Join(repo, "contracts", "mock", "startup.forecast.json"))
	if !bytes.Equal(readFile(t, filepath.Join(h.runsDir, started.ID, "forecast.json")), project) {
		t.Fatal("the run's forecast.json is not the project's")
	}
}

func TestRefusedAnswersStartNoRun(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	_, err := h.flow.Start("startup", &onboarding.Answers{Connection: onboarding.Floci, Targets: []string{"azure"}})
	if !errors.Is(err, onboarding.ErrInvalid) || !strings.Contains(err.Error(), "azure") {
		t.Fatalf("got %v", err)
	}
	if dirs := runDirs(t, h.runsDir); len(dirs) != 0 {
		t.Fatalf("a refused start left %v", dirs)
	}
	if listed := h.flow.List("", 10); len(listed) != 0 {
		t.Fatalf("a refused start is listed: %v", listed)
	}
}

func TestTheSetupListsTheCatalogsProvidersAndEveryProject(t *testing.T) {
	projects := projectsNamed(t, "zeta", "alpha")
	os.WriteFile(filepath.Join(projects, "notes.txt"), []byte("not a project"), 0o644)
	os.WriteFile(filepath.Join(projects, "Bad-Name.forecast.json"), []byte("{}"), 0o644)
	h := newHarness(t, options{maxRevisions: 2, projectsDir: projects})

	setup, err := h.flow.Onboarding()
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(setup.Providers, []string{"aws", "managed_pg"}) || !setup.Onprem {
		t.Fatalf("providers %v, onprem %v", setup.Providers, setup.Onprem)
	}
	ids := []string{}
	for _, project := range setup.Projects {
		ids = append(ids, project.ID)
		if project.ForbiddenProviders == nil || project.Description == "" {
			t.Errorf("%s: %+v", project.ID, project)
		}
	}
	if !slices.Equal(ids, []string{"alpha", "zeta"}) {
		t.Fatalf("projects %v", ids)
	}
}

func TestABrokenProjectForecastFailsTheSetupNamingIt(t *testing.T) {
	projects := projectsNamed(t, "startup")
	os.WriteFile(filepath.Join(projects, "broken.forecast.json"), []byte("{not json"), 0o644)
	h := newHarness(t, options{maxRevisions: 2, projectsDir: projects})
	if _, err := h.flow.Onboarding(); err == nil || !strings.Contains(err.Error(), "broken.forecast.json") {
		t.Fatalf("got %v", err)
	}
}

func BenchmarkTheSetupWithAThousandProjects(b *testing.B) {
	projects := b.TempDir()
	forecast := readFile(b, filepath.Join(repo, "contracts", "mock", "startup.forecast.json"))
	for i := range 1000 {
		os.WriteFile(filepath.Join(projects, fmt.Sprintf("project-%04d.forecast.json", i)), forecast, 0o644)
	}
	h := newHarness(&testing.T{}, options{maxRevisions: 2, projectsDir: projects, runsDir: b.TempDir()})
	b.ResetTimer()
	for b.Loop() {
		if setup, err := h.flow.Onboarding(); err != nil || len(setup.Projects) != 1000 {
			b.Fatal(err, len(setup.Projects))
		}
	}
}
