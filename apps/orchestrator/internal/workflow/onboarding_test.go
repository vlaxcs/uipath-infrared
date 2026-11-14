package workflow_test

import (
	"bytes"
	"context"
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
	"infrared/orchestrator/internal/workflow"
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
	setup, err := h.flow.Onboarding()
	if err != nil {
		t.Fatal(err)
	}
	unticked := []string{}
	for _, provider := range append(slices.Clone(setup.Providers), onboarding.OnpremProvider) {
		if provider != "aws" {
			unticked = append(unticked, provider)
		}
	}
	slices.Sort(unticked)
	forbidden := []any{}
	for _, provider := range unticked {
		forbidden = append(forbidden, provider)
	}
	hard["forbidden_providers"] = forbidden
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
	_, err := h.flow.Start("startup", &onboarding.Answers{Connection: onboarding.Floci, Targets: []string{"oracle"}})
	if !errors.Is(err, onboarding.ErrInvalid) || !strings.Contains(err.Error(), "oracle") {
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
	if !slices.Equal(setup.Providers, []string{"aws", "azure", "backblaze", "cloudflare", "fly", "gcp", "hetzner", "neon", "runpod", "supabase"}) || !setup.Onprem {
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

func TestTheSetupSaysWhetherFlociAnswersAndListsTheMarkets(t *testing.T) {
	for _, reachable := range []bool{true, false} {
		asked := ""
		h := newHarness(t, options{maxRevisions: 2, flociURL: "http://localhost:4566", probe: func(_ context.Context, url string) bool {
			asked = url
			return reachable
		}})
		setup, err := h.flow.Onboarding()
		if err != nil {
			t.Fatal(err)
		}
		floci := setup.Connections[0]
		if asked != "http://localhost:4566" || floci.Endpoint != asked || floci.Reachable == nil || *floci.Reachable != reachable {
			t.Fatalf("reachable %v: asked %q, connection %+v", reachable, asked, floci)
		}
		if !slices.Contains(setup.Markets, "fr") || !slices.Contains(setup.Markets, "us") {
			t.Fatalf("markets %v", setup.Markets)
		}
	}
}

func TestWithoutAFlociURLTheConnectionIsNotProbed(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2, probe: func(context.Context, string) bool {
		t.Fatal("probed without a URL")
		return false
	}})
	setup, _ := h.flow.Onboarding()
	if setup.Connections[0].Reachable != nil {
		t.Fatalf("connection %+v", setup.Connections[0])
	}
}

func TestEachProjectCarriesItsProfileWhenOneSitsBesideTheForecast(t *testing.T) {
	setup, err := newHarness(t, options{maxRevisions: 2}).flow.Onboarding()
	if err != nil {
		t.Fatal(err)
	}
	var clinic *onboarding.Project
	for index := range setup.Projects {
		if setup.Projects[index].ID == "clinic-booking" {
			clinic = &setup.Projects[index]
		}
	}
	if clinic == nil || clinic.Profile == nil {
		t.Fatalf("clinic-booking has no profile: %+v", clinic)
	}
	profile := clinic.Profile
	if profile.Name != "Clinic booking" || !slices.Equal(profile.Environments, []string{"prod", "staging", "dev"}) || !slices.Equal(profile.Markets, []string{"Romania"}) {
		t.Fatalf("profile %+v", profile)
	}
	if users := profile.Users; users == nil || users.Current != 41000 || users.Expected != 112500 || users.AtMonth != 24 {
		t.Fatalf("users %+v", profile.Users)
	}

	bare, err := newHarness(t, options{maxRevisions: 2, projectsDir: projectsNamed(t, "alpha")}).flow.Onboarding()
	if err != nil || bare.Projects[0].Profile != nil {
		t.Fatalf("a project without a profile file got %+v (%v)", bare.Projects[0].Profile, err)
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

func TestARunWithNoProjectIsForTheCompany(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2, projectsDir: projectsNamed(t, "company", "startup")})
	started, err := h.flow.Start("", nil)
	if err != nil {
		t.Fatal(err)
	}
	if started.Project != "company" || !strings.HasPrefix(started.ID, "run-company-") {
		t.Fatalf("started %s for %s", started.ID, started.Project)
	}
	named, err := h.flow.Start("startup", nil)
	if err != nil || named.Project != "startup" {
		t.Fatalf("an explicit project still starts its own run: %v %+v", err, named)
	}
}

func TestTheCompanySettingNamesWhichProjectARunDefaultsTo(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2, projectsDir: projectsNamed(t, "northwind"), company: "northwind"})
	setup, err := h.flow.Onboarding()
	if err != nil || setup.Company != "northwind" {
		t.Fatalf("setup company %q (%v)", setup.Company, err)
	}
	started, err := h.flow.Start("", nil)
	if err != nil || started.Project != "northwind" {
		t.Fatalf("started %+v (%v)", started, err)
	}
}

func TestWithoutTheCompanyForecastARunWithNoProjectIsRefused(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2, projectsDir: projectsNamed(t, "startup")})
	if _, err := h.flow.Start("", nil); !errors.Is(err, workflow.ErrUnknownProject) || !strings.Contains(err.Error(), "company.forecast.json") {
		t.Fatalf("got %v", err)
	}
}

func TestTheSetupNamesTheDefaultCompany(t *testing.T) {
	setup, err := newHarness(t, options{maxRevisions: 2}).flow.Onboarding()
	if err != nil || setup.Company != workflow.DefaultCompany {
		t.Fatalf("company %q (%v)", setup.Company, err)
	}
	encoded, _ := json.Marshal(setup)
	if !bytes.Contains(encoded, []byte(`"company":"company"`)) || !bytes.Contains(encoded, []byte(`"projects":[`)) {
		t.Fatalf("setup JSON %s", encoded)
	}
}

func TestExtractReadsTheRunsForecastBesideItsInfra(t *testing.T) {
	seen := make(chan []string, 1)
	forecastThere := make(chan bool, 1)
	extract := func(ctx context.Context, invocation workflow.Invocation) (workflow.Outcome, error) {
		seen <- invocation.Command
		_, err := os.Stat(argument(invocation.Command, "--forecast"))
		forecastThere <- err == nil
		return defaultStage("extract")(ctx, invocation)
	}
	h := newHarness(t, options{maxRevisions: 2, overrides: map[string]stage{"extract": extract}})
	started := h.start()
	command := <-seen
	dir := filepath.Join(h.runsDir, started.ID)
	want := []string{"extract", "--project", "startup", "--forecast", filepath.Join(dir, "forecast.json"), "--out", filepath.Join(dir, "infra.json")}
	if !slices.Equal(command, want) {
		t.Fatalf("extract ran as %q, want %q", command, want)
	}
	if !<-forecastThere {
		t.Fatal("the run's forecast.json was not in the run dir when extract ran")
	}
}
