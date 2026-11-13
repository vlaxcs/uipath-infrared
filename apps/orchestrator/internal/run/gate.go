package run

import (
	"errors"
	"fmt"
)

var (
	ErrInvalidDecision = errors.New("invalid decision")
	ErrGateNotOpen     = errors.New("gate not open")
)

var gateOfDecision = map[DecisionKind]Gate{
	KeepAnalyses: LayoutGate,
	PickLayout:   LayoutGate,
	ApprovePlan:  PlanGate,
}

var stepOfGate = map[Gate]Step{
	LayoutGate: Present,
	PlanGate:   Rehearse,
}

var surfaces = map[string]bool{"dashboard": true, "slack": true}

func CheckHumanDecision(event Event) error {
	if event.Status != Approved {
		return invalid("status must be approved")
	}
	if event.Actor.Kind != "human" || event.Actor.ID == "" || !surfaces[event.Actor.Surface] {
		return invalid("actor must be a human with an id and a surface of dashboard or slack")
	}
	if event.Gate != "" || event.Output != nil || event.XCandidates != nil {
		return invalid("a decision carries only step, status, actor and decision")
	}
	decision := event.Decision
	if decision == nil {
		return invalid("decision is missing")
	}
	gate, known := gateOfDecision[decision.Kind]
	if !known {
		return invalid("decision kind must be keep_analyses, pick_layout or approve_plan")
	}
	if decision.Reason == "" {
		return invalid("decision reason is empty")
	}
	if err := checkDecisionFields(decision); err != nil {
		return err
	}
	if event.Step != stepOfGate[gate] {
		return invalid(fmt.Sprintf("%s is decided on step %s", decision.Kind, stepOfGate[gate]))
	}
	return nil
}

func checkDecisionFields(decision *Decision) error {
	if (decision.Kind == KeepAnalyses) != (len(decision.Analyses) > 0) {
		return invalid("analyses come with keep_analyses, and only with it")
	}
	if (decision.Kind == PickLayout) != (decision.Layout != "") {
		return invalid("layout comes with pick_layout, and only with it")
	}
	seen := make(map[string]bool, len(decision.Analyses))
	for _, analysis := range decision.Analyses {
		if analysis == "" || seen[analysis] {
			return invalid("analyses must be non-empty and unique")
		}
		seen[analysis] = true
	}
	return nil
}

func (r *Run) CheckGateOpenFor(kind DecisionKind) error {
	gate := gateOfDecision[kind]
	if r.Status != AwaitingApproval || r.Awaiting != gate {
		return fmt.Errorf("%w: %s needs gate %s open, the run is %s", ErrGateNotOpen, kind, gate, r.describeState())
	}
	return nil
}

func (r *Run) describeState() string {
	if r.Awaiting != "" {
		return fmt.Sprintf("awaiting gate %s", r.Awaiting)
	}
	return string(r.Status)
}

func invalid(reason string) error {
	return fmt.Errorf("%w: %s", ErrInvalidDecision, reason)
}
