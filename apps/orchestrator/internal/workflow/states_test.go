package workflow_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"infrared/orchestrator/internal/run"
	"infrared/orchestrator/internal/workflow"
)

func waitForFile(t *testing.T, path string) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if _, err := os.Stat(path); err == nil {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("%s was never written", filepath.Base(path))
}

func TestTheWinnersStatesAreBuiltOnceEvaluateProceeds(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	id := h.start().ID
	h.waitForGate(id, run.LayoutGate)
	waitForFile(t, filepath.Join(h.runsDir, id, "states.1.agent-serverless-db-eu.json"))
	if _, err := os.Stat(filepath.Join(h.runsDir, id, "states.0.agent-serverless-db.json")); err == nil {
		t.Fatal("states were built for a revision that was sent back")
	}
}

func TestAPickedLayoutThatDidNotWinGetsItsOwnStates(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	id := h.start().ID
	h.waitForGate(id, run.LayoutGate)
	if err := h.pick(id, "rightsize_in_place"); err != nil {
		t.Fatal(err)
	}
	waitForFile(t, filepath.Join(h.runsDir, id, "states.1.rightsize_in_place.json"))
}

func TestAStatesBuildThatFailsNeverFailsTheRun(t *testing.T) {
	broken := func(context.Context, workflow.Invocation) (workflow.Outcome, error) {
		return workflow.Outcome{ExitCode: 1, StderrTail: "builder crashed"}, nil
	}
	h := newHarness(t, options{maxRevisions: 2, overrides: map[string]stage{"states": broken}})
	id := h.start().ID
	h.waitForGate(id, run.LayoutGate)
	if err := h.pick(id, "agent-serverless-db-eu"); err != nil {
		t.Fatal(err)
	}
	h.waitForGate(id, run.PlanGate)
	if err := h.approve(id); err != nil {
		t.Fatal(err)
	}
	if ended := h.waitForEnd(id); ended.Status != run.Completed {
		t.Fatalf("the run ended %s after a failed states build", ended.Status)
	}
}

func TestWithoutAStatesCommandNoStatesAreBuilt(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2, noStates: true})
	id := h.start().ID
	h.waitForGate(id, run.LayoutGate)
	time.Sleep(200 * time.Millisecond)
	matches, _ := filepath.Glob(filepath.Join(h.runsDir, id, "states.*.json"))
	if len(matches) != 0 || h.stages.callsTo("states") != 0 {
		t.Fatalf("states built without a command: %v", matches)
	}
}

func TestThePlanIsBuiltFromTheRunsOwnCatalog(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	id := h.start().ID
	h.waitForGate(id, run.LayoutGate)
	path := filepath.Join(h.runsDir, id, "states.1.agent-serverless-db-eu.json")
	waitForFile(t, path)
	var document struct {
		Dataset struct {
			Catalog string `json:"catalog"`
		} `json:"dataset"`
	}
	data, _ := os.ReadFile(path)
	if err := json.Unmarshal(data, &document); err != nil {
		t.Fatal(err)
	}
	if want := filepath.Join(h.runsDir, id, "catalog.json"); filepath.Clean(document.Dataset.Catalog) != filepath.Clean(want) {
		t.Fatalf("built from %q, want the run's %q", document.Dataset.Catalog, want)
	}
}
