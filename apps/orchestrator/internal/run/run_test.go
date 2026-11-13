package run

import (
	"errors"
	"strings"
	"testing"
	"time"
)

var start = time.Date(2026, 11, 14, 9, 0, 0, 0, time.UTC)

func newRun(maxRevisions int) *Run {
	return New("run-startup-0001", "startup", maxRevisions, Inputs{}, start)
}

func orchestrator(step Step, status EventStatus) Event {
	return Event{Step: step, Status: status, Actor: OrchestratorActor}
}

func TestAppendNumbersEventsWithoutGapsAndSummarises(t *testing.T) {
	r := newRun(2)
	r.Append(orchestrator(Extract, StepCompleted), start.Add(time.Second))
	r.Append(orchestrator(Investigate, Started), start.Add(2*time.Second))
	for i, event := range r.Events {
		if event.Seq != i+1 {
			t.Fatalf("event %d has seq %d", i, event.Seq)
		}
	}
	if r.Status != Running || r.Step != Investigate || r.StartedAt != "2026-11-14T09:00:00.000Z" || r.UpdatedAt != "2026-11-14T09:00:02.000Z" {
		t.Fatalf("summary = %+v", r.Summary)
	}
}

func TestAppendNeverDatesAnEventBeforeThePreviousOne(t *testing.T) {
	r := newRun(2)
	r.Append(orchestrator(Extract, StepCompleted), start.Add(-time.Hour))
	if r.Events[1].At != r.Events[0].At {
		t.Fatalf("a clock that went back gave %s after %s", r.Events[1].At, r.Events[0].At)
	}
}

func TestReviseRaisesTheRevisionOfTheEventsAfterIt(t *testing.T) {
	r := newRun(2)
	revise := orchestrator(Evaluate, StepCompleted)
	revise.Decision = &Decision{Kind: Revise, Reason: "x"}
	r.Append(revise, start)
	next := r.Append(orchestrator(Propose, Started), start)
	if r.Events[1].Revision != 0 || next.Revision != 1 || r.Revision != 1 {
		t.Fatalf("revise event %d, next %d, run %d", r.Events[1].Revision, next.Revision, r.Revision)
	}
}

func TestStatusFollowsTheLastEvent(t *testing.T) {
	gate := orchestrator(Present, OpensGate)
	gate.Gate = LayoutGate
	keep := Event{Step: Present, Status: Approved, Actor: Actor{Kind: "human", ID: "cto", Surface: "slack"}, Decision: &Decision{Kind: KeepAnalyses, Reason: "x", Analyses: []string{"a"}}}
	approve := Event{Step: Rehearse, Status: Approved, Actor: keep.Actor, Decision: &Decision{Kind: ApprovePlan, Reason: "x"}}
	failed := orchestrator(Extract, StepFailed)
	failed.Decision = &Decision{Kind: Stop, Reason: "x"}
	cases := []struct {
		name     string
		events   []Event
		status   Status
		awaiting Gate
	}{
		{"gate opened", []Event{gate}, AwaitingApproval, LayoutGate},
		{"analyses kept keep the gate open", []Event{gate, keep}, AwaitingApproval, LayoutGate},
		{"plan approved", []Event{approve}, Completed, ""},
		{"step failed", []Event{failed}, Failed, ""},
	}
	for _, c := range cases {
		r := newRun(2)
		for _, event := range c.events {
			r.Append(event, start)
		}
		if r.Status != c.status || r.Awaiting != c.awaiting {
			t.Errorf("%s: status %s awaiting %q", c.name, r.Status, r.Awaiting)
		}
		if (r.FinishedAt != "") != (c.status == Completed || c.status == Failed) {
			t.Errorf("%s: finished_at %q", c.name, r.FinishedAt)
		}
	}
}

func TestEventsAfterReturnsOnlyNewerEvents(t *testing.T) {
	r := newRun(2)
	r.Append(orchestrator(Extract, StepCompleted), start)
	if got := r.EventsAfter(1); len(got) != 1 || got[0].Seq != 2 {
		t.Fatalf("after 1 = %+v", got)
	}
	if got := r.EventsAfter(5); got == nil || len(got) != 0 {
		t.Fatalf("after the last seq = %#v, want an empty list", got)
	}
}

func TestEvaluateDecision(t *testing.T) {
	feasibleEngine := CandidateOutcome{ID: "rightsize_in_place", Source: "engine", Feasible: true}
	brokenAgent := CandidateOutcome{ID: "agent-db", Source: "agent", Constraints: []string{"data_residency", "data_residency", "budget"}}
	cases := []struct {
		name         string
		revision     int
		candidates   []CandidateOutcome
		kind         DecisionKind
		reasonPrefix string
	}{
		{"every agent candidate feasible", 0, []CandidateOutcome{feasibleEngine, {ID: "agent-ok", Source: "agent", Feasible: true}}, Proceed, "every candidate"},
		{"an agent candidate breaks a constraint", 0, []CandidateOutcome{feasibleEngine, brokenAgent}, Revise, "agent-db breaks data_residency, budget"},
		{"nothing feasible", 0, []CandidateOutcome{{ID: "do_nothing", Source: "engine"}}, Revise, "no candidate is feasible"},
		{"revisions used up", 2, []CandidateOutcome{feasibleEngine, brokenAgent}, Stop, "needs revision 3, max_revisions is 2; agent-db breaks"},
	}
	for _, c := range cases {
		r := newRun(2)
		r.Revision = c.revision
		decision := r.EvaluateDecision(Result{Candidates: c.candidates})
		if decision.Kind != c.kind || !strings.HasPrefix(decision.Reason, c.reasonPrefix) {
			t.Errorf("%s: %s %q", c.name, decision.Kind, decision.Reason)
		}
	}
}

func TestRehearsalDecision(t *testing.T) {
	r := newRun(1)
	if d := r.RehearsalDecision(true, "held"); d.Kind != Proceed || d.Reason != "held" {
		t.Fatalf("held: %+v", d)
	}
	if d := r.RehearsalDecision(false, "p95 over target"); d.Kind != Revise {
		t.Fatalf("missed: %+v", d)
	}
	r.Revision = 1
	if d := r.RehearsalDecision(false, "p95 over target"); d.Kind != Stop {
		t.Fatalf("missed with no revision left: %+v", d)
	}
}

func TestCheckHumanDecision(t *testing.T) {
	valid := func() Event {
		return Event{Step: Rehearse, Status: Approved, Actor: Actor{Kind: "human", ID: "cto", Surface: "slack"}, Decision: &Decision{Kind: ApprovePlan, Reason: "go"}}
	}
	if err := CheckHumanDecision(valid()); err != nil {
		t.Fatalf("a valid approval is refused: %v", err)
	}
	broken := map[string]func(*Event){
		"not approved":            func(e *Event) { e.Status = StepCompleted },
		"orchestrator actor":      func(e *Event) { e.Actor = OrchestratorActor },
		"unknown surface":         func(e *Event) { e.Actor.Surface = "email" },
		"no decision":             func(e *Event) { e.Decision = nil },
		"orchestrator decision":   func(e *Event) { e.Decision.Kind = Proceed },
		"empty reason":            func(e *Event) { e.Decision.Reason = "" },
		"wrong step for the gate": func(e *Event) { e.Step = Present },
		"layout without pick":     func(e *Event) { e.Decision.Layout = "x" },
		"analyses without keep":   func(e *Event) { e.Decision.Analyses = []string{"x"} },
		"carries a gate":          func(e *Event) { e.Gate = PlanGate },
		"pick without layout":     func(e *Event) { e.Step = Present; e.Decision.Kind = PickLayout },
		"keep with duplicate ids": func(e *Event) {
			e.Step = Present
			e.Decision.Kind = KeepAnalyses
			e.Decision.Analyses = []string{"a", "a"}
		},
	}
	for name, breakIt := range broken {
		event := valid()
		decision := *event.Decision
		event.Decision = &decision
		breakIt(&event)
		if err := CheckHumanDecision(event); !errors.Is(err, ErrInvalidDecision) {
			t.Errorf("%s: got %v, want an invalid decision", name, err)
		}
	}
}

func TestCheckGateOpenFor(t *testing.T) {
	r := newRun(2)
	if err := r.CheckGateOpenFor(ApprovePlan); !errors.Is(err, ErrGateNotOpen) {
		t.Fatalf("a running run accepts approve_plan: %v", err)
	}
	gate := orchestrator(Present, OpensGate)
	gate.Gate = LayoutGate
	r.Append(gate, start)
	if err := r.CheckGateOpenFor(PickLayout); err != nil {
		t.Fatalf("pick_layout refused at the layout gate: %v", err)
	}
	if err := r.CheckGateOpenFor(ApprovePlan); !errors.Is(err, ErrGateNotOpen) {
		t.Fatalf("approve_plan accepted at the layout gate: %v", err)
	}
}
