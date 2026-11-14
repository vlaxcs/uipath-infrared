package workflow_test

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"infrared/orchestrator/internal/run"
	"infrared/orchestrator/internal/workflow"
)

func writingLog(lines ...string) stage {
	return func(ctx context.Context, invocation workflow.Invocation) (workflow.Outcome, error) {
		os.MkdirAll(filepath.Dir(invocation.LogPath), 0o755)
		os.WriteFile(invocation.LogPath, []byte(strings.Join(lines, "\n")+"\n"), 0o644)
		return defaultStage("extract")(ctx, invocation)
	}
}

func TestAStepsLogIsReadFromAnOffset(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2, overrides: map[string]stage{"extract": writingLog("reading ec2", "reading rds", "wrote infra.json")}})
	id := h.start().ID
	h.waitForGate(id, run.LayoutGate)

	first, err := h.flow.ReadLog(id, run.Extract, 0)
	if err != nil {
		t.Fatal(err)
	}
	if first.Text != "reading ec2\nreading rds\nwrote infra.json\n" || first.Running || first.Next != int64(len(first.Text)) {
		t.Fatalf("first read %+v", first)
	}
	rest, err := h.flow.ReadLog(id, run.Extract, 12)
	if err != nil || rest.Text != "reading rds\nwrote infra.json\n" {
		t.Fatalf("read from 12: %+v %v", rest, err)
	}
	past, _ := h.flow.ReadLog(id, run.Extract, 10_000)
	if past.Text != "" || past.Next != first.Next {
		t.Fatalf("read past the end: %+v", past)
	}
}

func TestAStepInProgressSaysSo(t *testing.T) {
	release := make(chan struct{})
	slow := func(ctx context.Context, invocation workflow.Invocation) (workflow.Outcome, error) {
		os.MkdirAll(filepath.Dir(invocation.LogPath), 0o755)
		os.WriteFile(invocation.LogPath, []byte("investigating\n"), 0o644)
		select {
		case <-release:
		case <-ctx.Done():
		}
		return defaultStage("investigate")(ctx, invocation)
	}
	h := newHarness(t, options{maxRevisions: 2, overrides: map[string]stage{"investigate": slow}})
	id := h.start().ID
	defer close(release)

	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		chunk, err := h.flow.ReadLog(id, run.Investigate, 0)
		if err == nil && chunk.Text != "" {
			if !chunk.Running {
				t.Fatalf("a step that has not finished is reported done: %+v", chunk)
			}
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("the investigate log never appeared")
}

func TestALogForAStepThatHasNotStartedIsNotFound(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	id := h.start().ID
	h.waitForGate(id, run.LayoutGate)
	if _, err := h.flow.ReadLog(id, run.Rehearse, 0); !errors.Is(err, workflow.ErrNotFound) {
		t.Fatalf("rehearse before it started: %v", err)
	}
	if _, err := h.flow.ReadLog("run-startup-9999", run.Extract, 0); !errors.Is(err, workflow.ErrNotFound) {
		t.Fatalf("an unknown run: %v", err)
	}
}

func TestALongLogIsReadInWholeLines(t *testing.T) {
	line := strings.Repeat("x", 1000)
	lines := make([]string, 100)
	for i := range lines {
		lines[i] = line
	}
	h := newHarness(t, options{maxRevisions: 2, overrides: map[string]stage{"extract": writingLog(lines...)}})
	id := h.start().ID
	h.waitForGate(id, run.LayoutGate)

	var read strings.Builder
	var next int64
	for range 10 {
		chunk, err := h.flow.ReadLog(id, run.Extract, next)
		if err != nil {
			t.Fatal(err)
		}
		if chunk.Text == "" {
			break
		}
		if !strings.HasSuffix(chunk.Text, "\n") {
			t.Fatalf("a chunk ends mid-line at %d", chunk.Next)
		}
		read.WriteString(chunk.Text)
		next = chunk.Next
	}
	if read.String() != strings.Join(lines, "\n")+"\n" {
		t.Fatalf("read %d bytes of %d", read.Len(), len(strings.Join(lines, "\n"))+1)
	}
}
