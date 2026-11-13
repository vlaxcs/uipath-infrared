package workflow

import (
	"fmt"

	"infrared/orchestrator/internal/run"
)

type Feedback struct {
	Revision  int      `json:"revision"`
	FromStep  run.Step `json:"from_step"`
	Reason    string   `json:"reason"`
	Result    string   `json:"result"`
	Rehearsal *string  `json:"rehearsal"`
}

func (w *Workflow) begin(entry *tracked, step run.Step) (int, bool) {
	if err := w.ctx.Err(); err != nil {
		return 0, w.fail(entry, step, fmt.Sprintf("the orchestrator stopped during %s", step), nil)
	}
	entry.mu.Lock()
	defer entry.mu.Unlock()
	appended, err := w.commit(entry, run.Event{Step: step, Status: run.Started, Actor: run.OrchestratorActor})
	return appended.Seq, err == nil
}

func (w *Workflow) record(entry *tracked, event run.Event) bool {
	entry.mu.Lock()
	defer entry.mu.Unlock()
	_, err := w.commit(entry, event)
	return err == nil
}

func (w *Workflow) completeWithOutput(entry *tracked, step run.Step, output, contract string, decision *run.Decision) bool {
	file, err := w.fileRef(entry.dir, output)
	if err != nil {
		return w.fail(entry, step, fmt.Sprintf("%s: %v", output, err), nil)
	}
	return w.record(entry, run.Event{Step: step, Status: run.StepCompleted, Actor: run.OrchestratorActor, Decision: decision, Output: &run.Output{Contract: contract, File: file}})
}

func (w *Workflow) failWithOutput(entry *tracked, step run.Step, reason, output, contract string) {
	file, err := w.fileRef(entry.dir, output)
	if err != nil {
		w.fail(entry, step, reason, nil)
		return
	}
	w.fail(entry, step, reason, &run.Output{Contract: contract, File: file})
}

func (w *Workflow) fail(entry *tracked, step run.Step, reason string, output *run.Output) bool {
	w.record(entry, failure(step, reason, output))
	return false
}

func (w *Workflow) commit(entry *tracked, event run.Event) (run.Event, error) {
	before, count := entry.doc.Summary, len(entry.doc.Events)
	appended := entry.doc.Append(event, w.now())
	if err := w.store.Save(entry.doc); err != nil {
		entry.doc.Summary, entry.doc.Events = before, entry.doc.Events[:count]
		entry.doc.Append(failure(event.Step, fmt.Sprintf("could not write run.json: %v", err), nil), w.now())
		w.store.Save(entry.doc)
		w.release(entry.doc)
		return run.Event{}, err
	}
	if !entry.doc.Active() {
		w.release(entry.doc)
	}
	return appended, nil
}

func failure(step run.Step, reason string, output *run.Output) run.Event {
	return run.Event{Step: step, Status: run.StepFailed, Actor: run.OrchestratorActor, Decision: &run.Decision{Kind: run.Stop, Reason: reason}, Output: output}
}
