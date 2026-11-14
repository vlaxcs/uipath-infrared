package workflow

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
)

var statesCandidate = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]*$`)

var (
	ErrUnknownCandidate = errors.New("unknown candidate")
	ErrNoPlan           = errors.New("no plan")
)

// BuildPlan builds, once, the migration plan of any candidate of the latest
// result, so a person can review each one before picking a layout.
func (w *Workflow) BuildPlan(id, candidate string) (string, error) {
	entry, err := w.lookup(id)
	if err != nil {
		return "", err
	}
	revision := w.revisionOf(entry)
	result, err := w.files.ReadResult(w.path(entry, fmt.Sprintf("result.%d.json", revision)))
	if err != nil {
		return "", fmt.Errorf("%w: run %s has no result yet", ErrNoPlan, id)
	}
	known := false
	for _, outcome := range result.Candidates {
		known = known || outcome.ID == candidate
	}
	if !known || !statesCandidate.MatchString(candidate) {
		return "", fmt.Errorf("%w: %s is not a candidate of result.%d.json", ErrUnknownCandidate, candidate, revision)
	}
	name := fmt.Sprintf("states.%d.%s.json", revision, candidate)
	w.buildStates(entry, revision, candidate)
	if _, err := os.Stat(w.path(entry, name)); err != nil {
		return "", fmt.Errorf("%w: building %s failed; see logs/states-%d-%s.log", ErrNoPlan, name, revision, candidate)
	}
	return name, nil
}

func (w *Workflow) buildWinnerStates(entry *tracked, revision int) {
	result, err := w.files.ReadResult(w.path(entry, fmt.Sprintf("result.%d.json", revision)))
	if err != nil || result.Winner == "" {
		return
	}
	w.buildStates(entry, revision, result.Winner)
}

func (w *Workflow) buildPickedStates(entry *tracked, layout string) {
	revision := w.revisionOf(entry)
	result, err := w.files.ReadResult(w.path(entry, fmt.Sprintf("result.%d.json", revision)))
	if err != nil || layout == result.Winner {
		return
	}
	w.buildStates(entry, revision, layout)
}

func (w *Workflow) buildStates(entry *tracked, revision int, candidate string) {
	if len(w.config.Commands.States) == 0 || !statesCandidate.MatchString(candidate) {
		return
	}
	name := fmt.Sprintf("states.%d.%s.json", revision, candidate)
	if _, err := os.Stat(w.path(entry, name)); err == nil {
		return
	}
	command := w.command(w.config.Commands.States,
		"--infra", w.path(entry, "infra.json"),
		"--result", w.path(entry, fmt.Sprintf("result.%d.json", revision)),
		"--candidate", candidate,
		"--catalog", w.path(entry, "catalog.json"),
		"--out", w.path(entry, name))
	w.stages.Run(w.ctx, Invocation{
		Command: command,
		LogPath: filepath.Join(entry.dir, "logs", fmt.Sprintf("states-%d-%s.log", revision, candidate)),
		Timeout: StatesTimeout,
	})
}
