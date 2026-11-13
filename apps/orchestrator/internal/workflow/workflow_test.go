package workflow_test

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"infrared/orchestrator/internal/run"
	"infrared/orchestrator/internal/workflow"
)

func lastReason(r run.Run) string {
	last := r.Last()
	if last.Decision == nil {
		return ""
	}
	return last.Decision.Reason
}

func TestAnInjectedConstraintFailureTriggersExactlyOneRevision(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	started := h.start()
	atGate := h.waitForGate(started.ID, run.LayoutGate)
	if atGate.Status != run.AwaitingApproval || atGate.Revision != 1 {
		t.Fatalf("status %s, revision %d; want the layout gate after one revision", atGate.Status, atGate.Revision)
	}
	if h.stages.callsTo("propose") != 2 || h.stages.callsTo("investigate") != 1 {
		t.Fatalf("propose ran %d times and investigate %d, want 2 and 1", h.stages.callsTo("propose"), h.stages.callsTo("investigate"))
	}
	feedback, err := os.ReadFile(filepath.Join(h.runsDir, started.ID, "feedback.1.json"))
	if err != nil || !strings.Contains(string(feedback), "data_residency") {
		t.Fatalf("feedback.1.json = %s, %v; want the residency violation", feedback, err)
	}
}

func TestTheLayoutGateCarriesTheLatestCandidates(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	atGate := h.waitForGate(h.start().ID, run.LayoutGate)
	options := atGate.Last().XCandidates
	if len(options) == 0 || options[0].ID != "agent-serverless-db-eu" || !options[0].Feasible || options[0].MonthlyEUR == nil {
		t.Fatalf("x_candidates = %+v, want result.1.json's candidates with their figures", options)
	}
}

func TestTheDemoPathCompletesAfterThePlanIsApproved(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	id := h.start().ID
	h.waitForGate(id, run.LayoutGate)
	if err := h.pick(id, "agent-serverless-db-eu"); err != nil {
		t.Fatal(err)
	}
	h.waitForGate(id, run.PlanGate)
	if err := h.approve(id); err != nil {
		t.Fatal(err)
	}
	finished, _ := h.flow.Get(id)
	if finished.Status != run.Completed {
		t.Fatalf("status %s after the plan was approved", finished.Status)
	}
	if _, err := h.flow.Start("startup"); err != nil {
		t.Fatalf("a finished run still blocks its project: %v", err)
	}
}

func TestARevisePastTheCapStopsTheRun(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 0})
	ended := h.waitForEnd(h.start().ID)
	last := ended.Last()
	if ended.Status != run.Failed || last.Step != run.Evaluate || last.Decision.Kind != run.Stop || last.Output == nil {
		t.Fatalf("last event %+v; want evaluate failed with stop and its result", last)
	}
	if !strings.HasPrefix(last.Decision.Reason, "needs revision 1, max_revisions is 0; agent-serverless-db breaks data_residency") {
		t.Fatalf("reason %q", last.Decision.Reason)
	}
}

func TestStageFailuresStopTheRunWithTheReason(t *testing.T) {
	noOutput := func(context.Context, workflow.Invocation) (workflow.Outcome, error) { return workflow.Outcome{}, nil }
	brokenInfra := func(_ context.Context, invocation workflow.Invocation) (workflow.Outcome, error) {
		os.WriteFile(argument(invocation.Command, "--out"), []byte(`{"schema_version": "1.0"}`), 0o644)
		return workflow.Outcome{}, nil
	}
	wrongRevision := func(_ context.Context, invocation workflow.Invocation) (workflow.Outcome, error) {
		copyFile(filepath.Join(fixtures, "candidates.1.json"), argument(invocation.Command, "--out"))
		return workflow.Outcome{}, nil
	}
	cannotStart := func(context.Context, workflow.Invocation) (workflow.Outcome, error) {
		return workflow.Outcome{}, errors.New("executable file not found")
	}
	cases := []struct {
		name   string
		stage  string
		fake   stage
		step   run.Step
		reason string
	}{
		{"non-zero exit", "investigate", exitWith(3, "boto3 is not installed"), run.Investigate, "investigate exited 3: boto3 is not installed"},
		{"no output", "extract", noOutput, run.Extract, "wrote no infra.json"},
		{"output breaks its contract", "extract", brokenInfra, run.Extract, "infra.json breaks infra.schema.json"},
		{"candidates for another revision", "propose", wrongRevision, run.Propose, "candidates.0.json is revision 1, the run is on revision 0"},
		{"engine rejects its input", "engine", exitWith(2, "engine: bad forecast"), run.Evaluate, "evaluate exited 2: engine: bad forecast"},
		{"command missing", "extract", cannotStart, run.Extract, "extract could not start"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			h := newHarness(t, options{maxRevisions: 2, overrides: map[string]stage{c.stage: c.fake}})
			ended := h.waitForEnd(h.start().ID)
			if ended.Status != run.Failed || ended.Step != c.step || ended.Last().Decision.Kind != run.Stop {
				t.Fatalf("ended %s on %s with %+v", ended.Status, ended.Step, ended.Last().Decision)
			}
			if !strings.HasPrefix(lastReason(ended), c.reason) {
				t.Fatalf("reason %q, want it to start with %q", lastReason(ended), c.reason)
			}
		})
	}
}

func TestATimedOutStageStopsTheRun(t *testing.T) {
	slow := func(context.Context, workflow.Invocation) (workflow.Outcome, error) {
		return workflow.Outcome{ExitCode: -1, TimedOut: true}, nil
	}
	h := newHarness(t, options{maxRevisions: 2, overrides: map[string]stage{"extract": slow}, timeout: 5 * time.Second})
	ended := h.waitForEnd(h.start().ID)
	if lastReason(ended) != "extract timed out after 5s" {
		t.Fatalf("reason %q", lastReason(ended))
	}
}

func TestARehearsalThatMissesGoesBackToProposeOnce(t *testing.T) {
	var rehearsals atomic.Int32
	missThenHold := func(ctx context.Context, invocation workflow.Invocation) (workflow.Outcome, error) {
		defaultStage("sandbox")(ctx, invocation)
		if rehearsals.Add(1) == 1 {
			return workflow.Outcome{ExitCode: 1}, nil
		}
		return workflow.Outcome{}, nil
	}
	proposals := map[string]stage{
		"sandbox": missThenHold,
		"propose": func(_ context.Context, invocation workflow.Invocation) (workflow.Outcome, error) {
			copyFile(filepath.Join(fixtures, "candidates.1.json"), argument(invocation.Command, "--out"))
			rewriteRevision(argument(invocation.Command, "--out"), argument(invocation.Command, "--revision"))
			return workflow.Outcome{}, nil
		},
		"engine": func(_ context.Context, invocation workflow.Invocation) (workflow.Outcome, error) {
			copyFile(filepath.Join(fixtures, "result.1.json"), argument(invocation.Command, "--out"))
			return workflow.Outcome{}, nil
		},
	}
	h := newHarness(t, options{maxRevisions: 2, overrides: proposals})
	id := h.start().ID
	h.waitForGate(id, run.LayoutGate)
	if err := h.pick(id, "agent-serverless-db-eu"); err != nil {
		t.Fatal(err)
	}
	h.waitUntil(id, func(r run.Run) bool { return r.Revision == 1 && r.Awaiting == run.LayoutGate })
	if err := h.pick(id, "agent-serverless-db-eu"); err != nil {
		t.Fatal(err)
	}
	atPlan := h.waitForGate(id, run.PlanGate)
	feedback, _ := os.ReadFile(filepath.Join(h.runsDir, id, "feedback.1.json"))
	if atPlan.Revision != 1 || !strings.Contains(string(feedback), `"from_step": "rehearse"`) || !strings.Contains(string(feedback), "rehearsal.0.json") {
		t.Fatalf("revision %d, feedback %s", atPlan.Revision, feedback)
	}
}

func rewriteRevision(path, revision string) {
	var doc map[string]any
	data, _ := os.ReadFile(path)
	json.Unmarshal(data, &doc)
	doc["revision"] = json.Number(revision)
	if revision == "0" {
		for _, candidate := range doc["candidates"].([]any) {
			delete(candidate.(map[string]any), "revises")
		}
	}
	data, _ = json.Marshal(doc)
	os.WriteFile(path, data, 0o644)
}

func TestDecisionsAreCheckedAgainstTheOpenGate(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	id := h.start().ID
	h.waitForGate(id, run.LayoutGate)
	if err := h.approve(id); !errors.Is(err, run.ErrGateNotOpen) {
		t.Fatalf("approve_plan at the layout gate: %v", err)
	}
	if err := h.pick(id, "do_nothing"); !errors.Is(err, workflow.ErrLayoutNotFeasible) {
		t.Fatalf("an infeasible layout: %v", err)
	}
	if err := h.pick(id, "no-such-candidate"); !errors.Is(err, workflow.ErrLayoutNotFeasible) {
		t.Fatalf("an unknown layout: %v", err)
	}
	if _, err := h.flow.Decide("run-startup-9999", human(run.Present, run.Decision{Kind: run.PickLayout, Reason: "x", Layout: "y"})); !errors.Is(err, workflow.ErrNotFound) {
		t.Fatalf("an unknown run: %v", err)
	}
	keep := human(run.Present, run.Decision{Kind: run.KeepAnalyses, Reason: "x", Analyses: []string{"a"}})
	for range 2 {
		if _, err := h.flow.Decide(id, keep); err != nil {
			t.Fatalf("keep_analyses refused at the open gate: %v", err)
		}
	}
	if current, _ := h.flow.Get(id); current.Awaiting != run.LayoutGate {
		t.Fatalf("keep_analyses closed the gate: %+v", current.Summary)
	}
}

func TestTwoPicksAtTheSameGateAppendOnlyOne(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	id := h.start().ID
	h.waitForGate(id, run.LayoutGate)
	var accepted, conflicted atomic.Int32
	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() {
			switch err := h.pick(id, "agent-serverless-db-eu"); {
			case err == nil:
				accepted.Add(1)
			case errors.Is(err, run.ErrGateNotOpen):
				conflicted.Add(1)
			}
		})
	}
	wg.Wait()
	if accepted.Load() != 1 || conflicted.Load() != 7 {
		t.Fatalf("%d accepted, %d conflicted; want 1 and 7", accepted.Load(), conflicted.Load())
	}
}

func TestAProjectHasOneActiveRun(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	first := h.start()
	if _, err := h.flow.Start("startup"); !errors.Is(err, workflow.ErrProjectBusy) {
		t.Fatalf("a second run while %s is active: %v", first.ID, err)
	}
}

func TestUnknownProjectsAreRefused(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	for _, project := range []string{"nowhere", "../startup", "Startup", ""} {
		if _, err := h.flow.Start(project); !errors.Is(err, workflow.ErrUnknownProject) {
			t.Errorf("project %q: %v", project, err)
		}
	}
}

func TestOnlyOneRehearsalRunsAtATime(t *testing.T) {
	var inside, most atomic.Int32
	sandbox := func(ctx context.Context, invocation workflow.Invocation) (workflow.Outcome, error) {
		now := inside.Add(1)
		for {
			seen := most.Load()
			if now <= seen || most.CompareAndSwap(seen, now) {
				break
			}
		}
		time.Sleep(200 * time.Millisecond)
		inside.Add(-1)
		return defaultStage("sandbox")(ctx, invocation)
	}
	h := newHarness(t, options{maxRevisions: 2, overrides: map[string]stage{"sandbox": sandbox}, projectsDir: projectsNamed(t, "alpha", "beta")})
	ids := []string{}
	for _, project := range []string{"alpha", "beta"} {
		started, err := h.flow.Start(project)
		if err != nil {
			t.Fatal(err)
		}
		ids = append(ids, started.ID)
	}
	for _, id := range ids {
		h.waitForGate(id, run.LayoutGate)
		if err := h.pick(id, "agent-serverless-db-eu"); err != nil {
			t.Fatal(err)
		}
	}
	for _, id := range ids {
		h.waitForGate(id, run.PlanGate)
	}
	if most.Load() != 1 {
		t.Fatalf("%d rehearsals ran at once", most.Load())
	}
}

func TestARestartFailsTheRunsThatWereMidStep(t *testing.T) {
	runsDir := t.TempDir()
	blocked := make(chan struct{})
	hang := func(ctx context.Context, _ workflow.Invocation) (workflow.Outcome, error) {
		close(blocked)
		<-ctx.Done()
		return workflow.Outcome{ExitCode: -1}, nil
	}
	first := newHarness(t, options{maxRevisions: 2, runsDir: runsDir, overrides: map[string]stage{"investigate": hang}})
	id := first.start().ID
	<-blocked
	first.flow.Shutdown()
	stopped, _ := first.flow.Get(id)
	if lastReason(stopped) != "the orchestrator stopped during investigate" {
		t.Fatalf("after shutdown: %q", lastReason(stopped))
	}

	rewriteAsRunning(t, filepath.Join(runsDir, id, "run.json"))
	second := newHarness(t, options{maxRevisions: 2, runsDir: runsDir})
	reloaded, err := second.flow.Get(id)
	if err != nil {
		t.Fatal(err)
	}
	if reloaded.Status != run.Failed || lastReason(reloaded) != "the orchestrator restarted during investigate" {
		t.Fatalf("after restart: %s %q", reloaded.Status, lastReason(reloaded))
	}
	if next, err := second.flow.Start("startup"); err != nil || next.ID != "run-startup-0002" {
		t.Fatalf("next run %q, %v; want run-startup-0002", next.ID, err)
	}
}

func rewriteAsRunning(t *testing.T, path string) {
	t.Helper()
	data, _ := os.ReadFile(path)
	var doc run.Run
	if err := json.Unmarshal(data, &doc); err != nil {
		t.Fatal(err)
	}
	doc.Events = doc.Events[:len(doc.Events)-1]
	doc.Status, doc.FinishedAt, doc.Step, doc.UpdatedAt = run.Running, "", doc.Events[len(doc.Events)-1].Step, doc.Events[len(doc.Events)-1].At
	data, _ = json.Marshal(doc)
	os.WriteFile(path, data, 0o644)
}

func TestARunDirectoryThatDoesNotLoadStopsStartup(t *testing.T) {
	runsDir := t.TempDir()
	os.Mkdir(filepath.Join(runsDir, "run-startup-0001"), 0o755)
	os.WriteFile(filepath.Join(runsDir, "run-startup-0001", "run.json"), []byte("{"), 0o644)
	_, err := build(t, options{maxRevisions: 2, runsDir: runsDir})
	if err == nil || !strings.Contains(err.Error(), "run-startup-0001") {
		t.Fatalf("Load() = %v; want an error naming the run", err)
	}
}

func TestAFailedWriteFailsTheRunInMemory(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2, store: failingSaves(3)})
	ended := h.waitForEnd(h.start().ID)
	if ended.Status != run.Failed || !strings.Contains(lastReason(ended), "could not write run.json: disk full") {
		t.Fatalf("ended %s: %q", ended.Status, lastReason(ended))
	}
	for i, event := range ended.Events {
		if event.Seq != i+1 {
			t.Fatalf("event %d has seq %d after a failed write", i, event.Seq)
		}
	}
}
