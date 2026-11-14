package workflow_test

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"infrared/orchestrator/internal/run"
	"infrared/orchestrator/internal/workflow"
)

func TestRunFilesAreListedAndRead(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	started := h.start()
	h.waitForGate(started.ID, run.LayoutGate)

	files, err := h.flow.ListFiles(started.ID)
	if err != nil {
		t.Fatal(err)
	}
	names := map[string]bool{}
	for _, file := range files {
		names[file.Path] = true
	}
	for _, want := range []string{
		"infra.json", "findings.json", "candidates.0.json", "candidates.1.json",
		"result.0.json", "result.1.json", "feedback.1.json",
	} {
		if !names[want] {
			t.Errorf("the list is missing %s: %+v", want, files)
		}
	}
	for _, unwanted := range []string{"run.json", "forecast.json", "catalog.json"} {
		if names[unwanted] {
			t.Errorf("the list exposes %s", unwanted)
		}
	}

	data, err := h.flow.ReadFile(started.ID, "infra.json")
	if err != nil {
		t.Fatal(err)
	}
	if !json.Valid(data) {
		t.Fatalf("infra.json is not JSON: %s", data)
	}
}

func TestRunFilesRefuseNamesOutsideTheAllowlist(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	started := h.start()
	h.waitForGate(started.ID, run.LayoutGate)

	for _, name := range []string{
		"run.json", "forecast.json", "catalog.json",
		"logs/1-extract.log", "../run.json", "..", ".",
	} {
		if _, err := h.flow.ReadFile(started.ID, name); !errors.Is(err, workflow.ErrNotFound) {
			t.Errorf("%q: %v, want not found", name, err)
		}
	}
}

func TestRunFilesRefuseSymlinksAndHugeFiles(t *testing.T) {
	h := newHarness(t, options{maxRevisions: 2})
	started := h.start()
	h.waitForGate(started.ID, run.LayoutGate)
	dir := filepath.Join(h.runsDir, started.ID)

	link := filepath.Join(dir, "result.99.json")
	if err := os.Symlink("run.json", link); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}
	if _, err := h.flow.ReadFile(started.ID, "result.99.json"); !errors.Is(err, workflow.ErrNotFound) {
		t.Errorf("a symlink: %v, want not found", err)
	}
	if err := os.Remove(link); err != nil {
		t.Fatal(err)
	}

	huge, err := os.Create(filepath.Join(dir, "result.99.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := huge.Truncate(workflow.MaxArtifactBytes + 1); err != nil {
		t.Fatal(err)
	}
	if err := huge.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := h.flow.ReadFile(started.ID, "result.99.json"); !errors.Is(err, run.ErrArtifactTooLarge) {
		t.Errorf("a file over the cap: %v, want too large", err)
	}
}
