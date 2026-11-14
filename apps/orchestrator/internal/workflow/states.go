package workflow

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
)

var statesCandidate = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]*$`)

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
		"--out", w.path(entry, name))
	w.stages.Run(w.ctx, Invocation{
		Command: command,
		LogPath: filepath.Join(entry.dir, "logs", fmt.Sprintf("states-%d-%s.log", revision, candidate)),
		Timeout: StatesTimeout,
	})
}
