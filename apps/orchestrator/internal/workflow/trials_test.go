package workflow_test

import (
	"context"
	"errors"
	"path/filepath"
	"slices"
	"testing"

	"infrared/orchestrator/internal/run"
	"infrared/orchestrator/internal/workflow"
)

func pickedRun(t *testing.T, opts options) (*harness, string) {
	t.Helper()
	h := newHarness(t, opts)
	id := h.start().ID
	h.waitForGate(id, run.LayoutGate)
	if err := h.pick(id, "agent-serverless-db-eu"); err != nil {
		t.Fatal(err)
	}
	h.waitForGate(id, run.PlanGate)
	return h, id
}

func TestATrialRehearsesThePickedLayoutAtTheAskedRate(t *testing.T) {
	var asked []string
	sandbox := func(ctx context.Context, invocation workflow.Invocation) (workflow.Outcome, error) {
		asked = invocation.Command
		return defaultStage("sandbox")(ctx, invocation)
	}
	h, id := pickedRun(t, options{maxRevisions: 2, overrides: map[string]stage{"sandbox": sandbox}})
	before, _ := h.flow.Get(id)

	trial, err := h.flow.Rehearse(id, workflow.TrialProfile{RequestsPerSecond: 80, PhaseSeconds: 20})
	if err != nil {
		t.Fatal(err)
	}
	if trial.File != "rehearsal.1.trial-1.json" {
		t.Fatalf("trial file %q", trial.File)
	}
	waitForFile(t, filepath.Join(h.runsDir, id, trial.File))
	if !slices.Contains(asked, "--requests-per-second") || asked[slices.Index(asked, "--requests-per-second")+1] != "80" ||
		asked[slices.Index(asked, "--candidate")+1] != "agent-serverless-db-eu" || asked[slices.Index(asked, "--phase-seconds")+1] != "20" {
		t.Fatalf("sandbox asked %v", asked)
	}
	after, _ := h.flow.Get(id)
	if len(after.Events) != len(before.Events) || after.Status != before.Status {
		t.Fatal("a trial changed the run's events or status")
	}

	second, err := h.flow.Rehearse(id, workflow.TrialProfile{RequestsPerSecond: 5, PhaseSeconds: 10})
	if err != nil || second.File != "rehearsal.1.trial-2.json" {
		t.Fatalf("second trial %+v %v", second, err)
	}
	waitForFile(t, filepath.Join(h.runsDir, id, second.File))
	files, _ := h.flow.ListFiles(id)
	listed := 0
	for _, file := range files {
		if file.Path == trial.File || file.Path == second.File {
			listed++
		}
	}
	if listed != 2 {
		t.Fatalf("trials listed: %+v", files)
	}
}

func TestATrialNeedsAPickedLayout(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	id := h.start().ID
	h.waitForGate(id, run.LayoutGate)
	if _, err := h.flow.Rehearse(id, workflow.TrialProfile{RequestsPerSecond: 10, PhaseSeconds: 15}); !errors.Is(err, workflow.ErrNoLayout) {
		t.Fatalf("before a layout is picked: %v", err)
	}
	if _, err := h.flow.Rehearse("run-startup-9999", workflow.TrialProfile{RequestsPerSecond: 10, PhaseSeconds: 15}); !errors.Is(err, workflow.ErrNotFound) {
		t.Fatalf("an unknown run: %v", err)
	}
}

func TestATrialOutsideTheLimitsIsRefused(t *testing.T) {
	h, id := pickedRun(t, options{maxRevisions: 2})
	for _, profile := range []workflow.TrialProfile{
		{RequestsPerSecond: 0, PhaseSeconds: 15},
		{RequestsPerSecond: 201, PhaseSeconds: 15},
		{RequestsPerSecond: 10, PhaseSeconds: 4},
		{RequestsPerSecond: 10, PhaseSeconds: 121},
	} {
		if _, err := h.flow.Rehearse(id, profile); !errors.Is(err, workflow.ErrInvalidTrial) {
			t.Errorf("%+v: %v", profile, err)
		}
	}
}

func TestOneTrialAtATimePerRun(t *testing.T) {
	release := make(chan struct{})
	calls := 0
	sandbox := func(ctx context.Context, invocation workflow.Invocation) (workflow.Outcome, error) {
		calls++
		if calls > 1 {
			<-release
		}
		return defaultStage("sandbox")(ctx, invocation)
	}
	h, id := pickedRun(t, options{maxRevisions: 2, overrides: map[string]stage{"sandbox": sandbox}})
	defer close(release)
	if _, err := h.flow.Rehearse(id, workflow.TrialProfile{RequestsPerSecond: 10, PhaseSeconds: 15}); err != nil {
		t.Fatal(err)
	}
	if _, err := h.flow.Rehearse(id, workflow.TrialProfile{RequestsPerSecond: 10, PhaseSeconds: 15}); !errors.Is(err, workflow.ErrTrialRunning) {
		t.Fatalf("a second trial while one runs: %v", err)
	}
}
