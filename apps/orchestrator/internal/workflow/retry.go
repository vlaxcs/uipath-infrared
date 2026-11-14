package workflow

import (
	"errors"
	"fmt"

	"infrared/orchestrator/internal/run"
)

var ErrNotRetryable = errors.New("not retryable")

// Retry resumes a failed run from the step it failed at, reusing the files the
// earlier steps wrote: a rehearsal that fell over is rehearsed again, a failed
// propose proposes again, without extracting and investigating from scratch.
func (w *Workflow) Retry(id string) (run.Run, error) {
	entry, err := w.lookup(id)
	if err != nil {
		return run.Run{}, err
	}
	w.mu.Lock()
	entry.mu.Lock()
	project, status, step := entry.doc.Project, entry.doc.Status, entry.doc.Step
	entry.mu.Unlock()
	if status != run.Failed {
		w.mu.Unlock()
		return run.Run{}, fmt.Errorf("%w: %s is %s, not failed", ErrNotRetryable, id, status)
	}
	if busy, found := w.active[project]; found {
		w.mu.Unlock()
		return run.Run{}, fmt.Errorf("%w: %s is %s", ErrProjectBusy, project, busy)
	}
	w.active[project] = id
	w.mu.Unlock()

	switch step {
	case run.Extract:
		w.launch(func() {
			if _, ok := w.begin(entry, run.Extract); ok {
				w.fromExtract(entry)
			}
		})
	case run.Investigate:
		w.launch(func() {
			if w.investigate(entry) {
				w.proposeToPresent(entry)
			}
		})
	case run.Propose, run.Evaluate:
		w.launch(func() { w.proposeToPresent(entry) })
	case run.Present:
		w.launch(func() { w.present(entry) })
	case run.Rehearse:
		w.launch(func() { w.fromRehearse(entry) })
	default:
		w.release(entry.doc)
		return run.Run{}, fmt.Errorf("%w: %s failed at %s", ErrNotRetryable, id, step)
	}
	entry.mu.Lock()
	defer entry.mu.Unlock()
	return snapshot(entry.doc), nil
}
