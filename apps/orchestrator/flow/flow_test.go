package flow_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
	"time"

	"infrared/orchestrator/internal/app"
	"infrared/orchestrator/internal/run"
	"infrared/orchestrator/internal/settings"
)

const pollDeadline = 3 * time.Minute

func TestDemoPathEndToEnd(t *testing.T) {
	repo := repoRoot(t)
	runsDir := t.TempDir()
	python := envOr("FLOW_PYTHON", "python")
	stubs := filepath.Join(repo, "apps", "orchestrator", "testdata", "stubs")

	t.Setenv("ORCHESTRATOR_ADDR", "127.0.0.1:0")
	t.Setenv("ORCHESTRATOR_RUNS_DIR", runsDir)
	t.Setenv("ORCHESTRATOR_CONTRACTS_DIR", filepath.Join(repo, "contracts"))
	t.Setenv("ORCHESTRATOR_PROJECTS_DIR", filepath.Join(repo, "contracts", "mock"))
	t.Setenv("ORCHESTRATOR_CATALOG", filepath.Join(repo, "contracts", "real", "catalog.json"))
	t.Setenv("ORCHESTRATOR_MAX_REVISIONS", "2")
	t.Setenv("ORCHESTRATOR_EXTRACT_CMD", envOr("FLOW_EXTRACT_CMD", python+" "+filepath.Join(stubs, "extract.py")))
	t.Setenv("ORCHESTRATOR_AGENT_CMD", envOr("FLOW_AGENT_CMD", python+" "+filepath.Join(stubs, "agent.py")))
	t.Setenv("ORCHESTRATOR_ENGINE_CMD", envOr("FLOW_ENGINE_CMD", python+" -m engine"))
	t.Setenv("ORCHESTRATOR_SANDBOX_CMD", envOr("FLOW_SANDBOX_CMD", python+" "+filepath.Join(stubs, "sandbox.py")))
	t.Setenv("PYTHONPATH", filepath.Join(repo, "apps", "engine"))

	config, err := settings.Load()
	if err != nil {
		t.Fatal(err)
	}
	orchestrator, err := app.Build(config)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(orchestrator.Handler)
	defer server.Close()
	defer orchestrator.Workflow.Shutdown()
	client := apiClient{t: t, base: server.URL}

	var started run.Run
	client.call("POST", "/runs", map[string]string{"project": "startup"}, http.StatusCreated, &started)

	layoutGate := client.waitFor(started.ID, func(e run.Event) bool { return e.Gate == run.LayoutGate })

	var artifacts []run.Artifact
	client.call("GET", "/runs/"+started.ID+"/files", nil, http.StatusOK, &artifacts)
	if !slices.ContainsFunc(artifacts, func(artifact run.Artifact) bool { return artifact.Path == "infra.json" }) {
		t.Fatalf("the artifact list is missing infra.json: %+v", artifacts)
	}
	var infra map[string]any
	client.call("GET", "/runs/"+started.ID+"/files/infra.json", nil, http.StatusOK, &infra)
	if components, ok := infra["components"].([]any); !ok || len(components) == 0 {
		t.Fatalf("infra.json carries no components: %+v", infra)
	}
	client.call("GET", "/runs/"+started.ID+"/files/run.json", nil, http.StatusNotFound, nil)

	evaluations := client.decisionsOn(started.ID, run.Evaluate)
	if len(evaluations) != 2 || evaluations[0].Kind != run.Revise || evaluations[1].Kind != run.Proceed {
		t.Fatalf("evaluate decisions = %+v, want one revise then one proceed", evaluations)
	}
	if !strings.Contains(evaluations[0].Reason, "agent-serverless-db breaks data_residency") {
		t.Fatalf("revise reason %q does not name the residency break", evaluations[0].Reason)
	}

	layout := firstFeasible(t, layoutGate.XCandidates)
	client.decide(started.ID, run.Present, human("dashboard"), run.Decision{Kind: run.KeepAnalyses, Reason: "the single-zone finding stands", Analyses: []string{"single-zone-db"}}, http.StatusCreated)
	client.decide(started.ID, run.Present, human("dashboard"), run.Decision{Kind: run.PickLayout, Reason: "stays in the EU", Layout: layout}, http.StatusCreated)

	client.waitFor(started.ID, func(e run.Event) bool { return e.Gate == run.PlanGate })
	client.decide(started.ID, run.Rehearse, human("slack"), run.Decision{Kind: run.ApprovePlan, Reason: "rehearsal held; go ahead"}, http.StatusCreated)

	var finished run.Run
	client.call("GET", "/runs/"+started.ID, nil, http.StatusOK, &finished)
	if finished.Status != run.Completed || finished.Revision != 1 {
		t.Fatalf("run ended %s with %d revisions, want completed with 1", finished.Status, finished.Revision)
	}
	checkWithContractChecker(t, python, repo, filepath.Join(runsDir, started.ID, "run.json"))
}

func checkWithContractChecker(t *testing.T, python, repo, runFile string) {
	t.Helper()
	output, err := exec.Command(python, filepath.Join(repo, "contracts", "check_run.py"), runFile).CombinedOutput()
	if err != nil {
		t.Fatalf("contracts/check_run.py rejects the finished run:\n%s", output)
	}
}

func firstFeasible(t *testing.T, options []run.LayoutOption) string {
	t.Helper()
	for _, option := range options {
		if option.Feasible {
			return option.ID
		}
	}
	t.Fatalf("the layout gate offers no feasible candidate: %+v", options)
	return ""
}

func human(surface string) run.Actor {
	return run.Actor{Kind: "human", ID: "cto", Surface: surface}
}

type apiClient struct {
	t    *testing.T
	base string
}

func (c apiClient) call(method, path string, body any, wantStatus int, into any) {
	c.t.Helper()
	var payload bytes.Buffer
	if body != nil {
		json.NewEncoder(&payload).Encode(body)
	}
	request, _ := http.NewRequest(method, c.base+path, &payload)
	request.Header.Set("Content-Type", "application/json")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		c.t.Fatal(err)
	}
	defer response.Body.Close()
	var raw bytes.Buffer
	raw.ReadFrom(response.Body)
	if response.StatusCode != wantStatus {
		c.t.Fatalf("%s %s answered %d, want %d: %s", method, path, response.StatusCode, wantStatus, raw.String())
	}
	if into != nil {
		if err := json.Unmarshal(raw.Bytes(), into); err != nil {
			c.t.Fatal(err)
		}
	}
}

func (c apiClient) decide(id string, step run.Step, actor run.Actor, decision run.Decision, wantStatus int) {
	c.t.Helper()
	c.call("POST", "/runs/"+id+"/decisions", run.Event{Step: step, Status: run.Approved, Actor: actor, Decision: &decision}, wantStatus, nil)
}

func (c apiClient) waitFor(id string, match func(run.Event) bool) run.Event {
	c.t.Helper()
	seen := 0
	deadline := time.Now().Add(pollDeadline)
	for time.Now().Before(deadline) {
		var events []run.Event
		c.call("GET", fmt.Sprintf("/runs/%s/events?after=%d", id, seen), nil, http.StatusOK, &events)
		for _, event := range events {
			if event.Status == run.StepFailed {
				c.t.Fatalf("the run failed on %s: %s", event.Step, event.Decision.Reason)
			}
			if match(event) {
				return event
			}
		}
		seen += len(events)
		time.Sleep(100 * time.Millisecond)
	}
	c.t.Fatalf("run %s did not reach the expected event in %s", id, pollDeadline)
	return run.Event{}
}

func (c apiClient) decisionsOn(id string, step run.Step) []run.Decision {
	c.t.Helper()
	var doc run.Run
	c.call("GET", "/runs/"+id, nil, http.StatusOK, &doc)
	var decisions []run.Decision
	for _, event := range doc.Events {
		if event.Step == step && event.Decision != nil {
			decisions = append(decisions, *event.Decision)
		}
	}
	return decisions
}

func repoRoot(t *testing.T) string {
	t.Helper()
	_, file, _, _ := runtime.Caller(0)
	root, err := filepath.Abs(filepath.Join(filepath.Dir(file), "..", "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "contracts", "run.schema.json")); err != nil {
		t.Fatalf("%s is not the repo root: %v", root, err)
	}
	return root
}

func envOr(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
