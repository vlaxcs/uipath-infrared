package workflow

import (
	"fmt"
	"path/filepath"

	"infrared/orchestrator/internal/run"
)

const firstEventSeq = 1

func (w *Workflow) fromExtract(entry *tracked) {
	project := entry.doc.Project
	if !w.produce(entry, run.Extract, firstEventSeq, w.extractCommand(entry, project), "infra.json", "infra") {
		return
	}
	if !w.completeWithOutput(entry, run.Extract, "infra.json", "infra", nil) {
		return
	}
	if !w.investigate(entry) {
		return
	}
	w.proposeToPresent(entry)
}

func (w *Workflow) investigate(entry *tracked) bool {
	seq, ok := w.begin(entry, run.Investigate)
	if !ok || !w.invoke(entry, run.Investigate, seq, w.agentCommand(entry, "investigate", "--infra", w.path(entry, "infra.json"), "--out", w.path(entry, "findings.json")), "findings.json", 0) {
		return false
	}
	if err := w.files.CheckObject(w.path(entry, "findings.json")); err != nil {
		return w.fail(entry, run.Investigate, fmt.Sprintf("findings.json: %v", err), nil)
	}
	return w.record(entry, run.Event{Step: run.Investigate, Status: run.StepCompleted, Actor: run.OrchestratorActor})
}

func (w *Workflow) proposeToPresent(entry *tracked) {
	for {
		revision := w.revisionOf(entry)
		if !w.propose(entry, revision) {
			return
		}
		decision, ok := w.evaluate(entry, revision)
		if !ok {
			return
		}
		if decision == run.Proceed {
			w.present(entry)
			return
		}
	}
}

func (w *Workflow) propose(entry *tracked, revision int) bool {
	candidates := fmt.Sprintf("candidates.%d.json", revision)
	arguments := []string{"propose", "--infra", w.path(entry, "infra.json"), "--forecast", w.path(entry, "forecast.json"), "--findings", w.path(entry, "findings.json"), "--revision", fmt.Sprint(revision)}
	if revision > 0 {
		arguments = append(arguments, "--feedback", w.path(entry, feedbackFile(revision)))
	}
	arguments = append(arguments, "--out", w.path(entry, candidates))
	seq, ok := w.begin(entry, run.Propose)
	if !ok || !w.produce(entry, run.Propose, seq, w.agentCommand(entry, arguments...), candidates, "candidates") {
		return false
	}
	written, err := w.files.ReadCandidatesRevision(w.path(entry, candidates))
	if err != nil {
		return w.fail(entry, run.Propose, fmt.Sprintf("%s: %v", candidates, err), nil)
	}
	if written != revision {
		return w.fail(entry, run.Propose, fmt.Sprintf("%s is revision %d, the run is on revision %d", candidates, written, revision), nil)
	}
	return w.record(entry, run.Event{Step: run.Propose, Status: run.StepCompleted, Actor: run.OrchestratorActor})
}

func (w *Workflow) evaluate(entry *tracked, revision int) (run.DecisionKind, bool) {
	result := fmt.Sprintf("result.%d.json", revision)
	command := w.engineCommand(entry, "evaluate", w.path(entry, "infra.json"), w.path(entry, "forecast.json"), w.path(entry, "catalog.json"), "--candidates", w.path(entry, fmt.Sprintf("candidates.%d.json", revision)), "--out", w.path(entry, result))
	seq, ok := w.begin(entry, run.Evaluate)
	if !ok || !w.produce(entry, run.Evaluate, seq, command, result, "result") {
		return "", false
	}
	outcome, err := w.files.ReadResult(w.path(entry, result))
	if err != nil {
		return "", w.fail(entry, run.Evaluate, fmt.Sprintf("%s: %v", result, err), nil)
	}
	entry.mu.Lock()
	decision := entry.doc.EvaluateDecision(outcome)
	entry.mu.Unlock()
	return decision.Kind, w.decide(entry, run.Evaluate, result, "result", decision, Feedback{FromStep: run.Evaluate, Result: result})
}

func (w *Workflow) present(entry *tracked) {
	if _, ok := w.begin(entry, run.Present); !ok {
		return
	}
	resultFile := w.latest(entry, "result")
	result, err := w.files.ReadResult(w.path(entry, resultFile))
	if err != nil {
		w.fail(entry, run.Present, fmt.Sprintf("%s: %v", resultFile, err), nil)
		return
	}
	w.record(entry, run.Event{Step: run.Present, Status: run.OpensGate, Actor: run.OrchestratorActor, Gate: run.LayoutGate, XCandidates: result.LayoutOptions()})
}

func (w *Workflow) fromRehearse(entry *tracked) {
	select {
	case w.rehearsal <- struct{}{}:
	case <-w.ctx.Done():
		w.fail(entry, run.Rehearse, "the orchestrator stopped during rehearse", nil)
		return
	}
	decision, ok := w.rehearse(entry)
	<-w.rehearsal
	switch {
	case !ok:
	case decision == run.Proceed:
		w.record(entry, run.Event{Step: run.Rehearse, Status: run.OpensGate, Actor: run.OrchestratorActor, Gate: run.PlanGate})
	case decision == run.Revise:
		w.proposeToPresent(entry)
	}
}

func (w *Workflow) rehearse(entry *tracked) (run.DecisionKind, bool) {
	revision := w.revisionOf(entry)
	rehearsal := fmt.Sprintf("rehearsal.%d.json", revision)
	resultFile := w.latest(entry, "result")
	command := w.sandboxCommand(entry, "rehearse", "--result", w.path(entry, resultFile), "--candidate", w.pickedLayout(entry), "--infra", w.path(entry, "infra.json"), "--forecast", w.path(entry, "forecast.json"), "--out", w.path(entry, rehearsal))
	seq, ok := w.begin(entry, run.Rehearse)
	if !ok {
		return "", false
	}
	outcome, ok := w.run(entry, run.Rehearse, seq, command, 0, 1)
	if !ok || !w.checkOutput(entry, run.Rehearse, rehearsal, "rehearsal") {
		return "", false
	}
	reason, err := w.files.ReadRehearsalReason(w.path(entry, rehearsal))
	if err != nil {
		return "", w.fail(entry, run.Rehearse, fmt.Sprintf("%s: %v", rehearsal, err), nil)
	}
	entry.mu.Lock()
	decision := entry.doc.RehearsalDecision(outcome.ExitCode == 0, reason)
	entry.mu.Unlock()
	return decision.Kind, w.decide(entry, run.Rehearse, rehearsal, "rehearsal", decision, Feedback{FromStep: run.Rehearse, Result: resultFile, Rehearsal: &rehearsal})
}

func (w *Workflow) decide(entry *tracked, step run.Step, output, contract string, decision run.Decision, feedback Feedback) bool {
	switch decision.Kind {
	case run.Stop:
		w.failWithOutput(entry, step, decision.Reason, output, contract)
		return false
	case run.Revise:
		feedback.Revision = w.revisionOf(entry) + 1
		feedback.Reason = decision.Reason
		if err := w.files.WriteJSON(w.path(entry, feedbackFile(feedback.Revision)), feedback); err != nil {
			return w.fail(entry, step, fmt.Sprintf("%s: %v", feedbackFile(feedback.Revision), err), nil)
		}
	}
	return w.completeWithOutput(entry, step, output, contract, &decision)
}

func (w *Workflow) produce(entry *tracked, step run.Step, seq int, command []string, output, contract string) bool {
	return w.invoke(entry, step, seq, command, output, 0) && w.checkOutput(entry, step, output, contract)
}

func (w *Workflow) invoke(entry *tracked, step run.Step, seq int, command []string, output string, accepted ...int) bool {
	if _, ok := w.run(entry, step, seq, command, accepted...); !ok {
		return false
	}
	return w.checkWritten(entry, step, output)
}

func (w *Workflow) checkWritten(entry *tracked, step run.Step, output string) bool {
	if _, err := w.files.Hash(w.path(entry, output)); err != nil {
		return w.fail(entry, step, fmt.Sprintf("wrote no %s", output), nil)
	}
	return true
}

func (w *Workflow) checkOutput(entry *tracked, step run.Step, output, contract string) bool {
	if !w.checkWritten(entry, step, output) {
		return false
	}
	if err := w.contracts.Check(contract, w.path(entry, output)); err != nil {
		return w.fail(entry, step, fmt.Sprintf("%s breaks %s.schema.json: %v", output, contract, err), nil)
	}
	return true
}

func (w *Workflow) path(entry *tracked, name string) string {
	return filepath.Join(entry.dir, name)
}

func (w *Workflow) latest(entry *tracked, contract string) string {
	entry.mu.Lock()
	defer entry.mu.Unlock()
	return latestOutput(entry.doc, contract)
}

func (w *Workflow) revisionOf(entry *tracked) int {
	entry.mu.Lock()
	defer entry.mu.Unlock()
	return entry.doc.Revision
}

func (w *Workflow) pickedLayout(entry *tracked) string {
	entry.mu.Lock()
	defer entry.mu.Unlock()
	for i := len(entry.doc.Events) - 1; i >= 0; i-- {
		if decision := entry.doc.Events[i].Decision; decision != nil && decision.Kind == run.PickLayout {
			return decision.Layout
		}
	}
	return ""
}

func feedbackFile(revision int) string {
	return fmt.Sprintf("feedback.%d.json", revision)
}
