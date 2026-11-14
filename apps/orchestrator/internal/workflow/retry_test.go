package workflow_test

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"

	"infrared/orchestrator/internal/run"
	"infrared/orchestrator/internal/workflow"
)

func TestAFailedRunResumesFromTheStepItFailedAt(t *testing.T) {
	var proposals atomic.Int32
	flaky := func(ctx context.Context, invocation workflow.Invocation) (workflow.Outcome, error) {
		if proposals.Add(1) == 1 {
			return workflow.Outcome{ExitCode: 1, StderrTail: "the model finished without submitting"}, nil
		}
		return defaultStage("propose")(ctx, invocation)
	}
	h := newHarness(t, options{maxRevisions: 2, overrides: map[string]stage{"propose": flaky}})
	id := h.start().ID
	failed := h.waitForEnd(id)
	if failed.Status != run.Failed || failed.Step != run.Propose {
		t.Fatalf("first attempt ended %s on %s", failed.Status, failed.Step)
	}

	if _, err := h.flow.Retry(id); err != nil {
		t.Fatal(err)
	}
	h.waitUntil(id, func(r run.Run) bool { return r.Awaiting == run.LayoutGate })
	if extracts, investigations := h.stages.callsTo("extract"), h.stages.callsTo("investigate"); extracts != 1 || investigations != 1 {
		t.Fatalf("resume redid earlier steps: extract %d, investigate %d", extracts, investigations)
	}
	if _, err := h.flow.Retry(id); !errors.Is(err, workflow.ErrNotRetryable) {
		t.Fatalf("retrying a run that is not failed: %v", err)
	}
}
