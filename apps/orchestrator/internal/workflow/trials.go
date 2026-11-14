package workflow

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"

	"infrared/orchestrator/internal/run"
)

const (
	MinTrialRate    = 1
	MaxTrialRate    = 200
	MinTrialSeconds = 5.0
	MaxTrialSeconds = 120.0
)

var (
	ErrNoLayout     = errors.New("no layout picked")
	ErrInvalidTrial = errors.New("invalid trial")
	ErrTrialRunning = errors.New("trial running")
)

var trialName = regexp.MustCompile(`^rehearsal\.(\d+)\.trial-(\d+)\.json$`)

type TrialProfile struct {
	RequestsPerSecond int     `json:"requests_per_second"`
	PhaseSeconds      float64 `json:"phase_seconds"`
}

type TrialStarted struct {
	File      string `json:"file"`
	Candidate string `json:"candidate"`
}

func (w *Workflow) Rehearse(id string, profile TrialProfile) (TrialStarted, error) {
	if profile.RequestsPerSecond < MinTrialRate || profile.RequestsPerSecond > MaxTrialRate {
		return TrialStarted{}, fmt.Errorf("%w: requests_per_second must be from %d to %d", ErrInvalidTrial, MinTrialRate, MaxTrialRate)
	}
	if profile.PhaseSeconds < MinTrialSeconds || profile.PhaseSeconds > MaxTrialSeconds {
		return TrialStarted{}, fmt.Errorf("%w: phase_seconds must be from %g to %g", ErrInvalidTrial, MinTrialSeconds, MaxTrialSeconds)
	}
	entry, err := w.lookup(id)
	if err != nil {
		return TrialStarted{}, err
	}
	layout := w.pickedLayout(entry)
	if layout == "" {
		return TrialStarted{}, fmt.Errorf("%w: pick a layout before rehearsing it", ErrNoLayout)
	}
	entry.mu.Lock()
	if entry.trialRunning {
		entry.mu.Unlock()
		return TrialStarted{}, fmt.Errorf("%w: a trial of %s is still running", ErrTrialRunning, id)
	}
	revision := entry.doc.Revision
	resultFile := latestOutput(entry.doc, "result")
	name := fmt.Sprintf("rehearsal.%d.trial-%d.json", revision, nextTrial(entry.dir, revision))
	entry.trialRunning = true
	entry.mu.Unlock()

	w.launch(func() { w.runTrial(entry, layout, resultFile, name, profile) })
	return TrialStarted{File: name, Candidate: layout}, nil
}

func (w *Workflow) runTrial(entry *tracked, layout, resultFile, name string, profile TrialProfile) {
	defer func() {
		entry.mu.Lock()
		entry.trialRunning = false
		entry.mu.Unlock()
	}()
	select {
	case w.rehearsal <- struct{}{}:
	case <-w.ctx.Done():
		return
	}
	defer func() { <-w.rehearsal }()
	command := w.sandboxCommand(entry, "rehearse",
		"--result", w.path(entry, resultFile),
		"--candidate", layout,
		"--infra", w.path(entry, "infra.json"),
		"--forecast", w.path(entry, "forecast.json"),
		"--out", w.path(entry, name),
		"--requests-per-second", strconv.Itoa(profile.RequestsPerSecond),
		"--phase-seconds", strconv.FormatFloat(profile.PhaseSeconds, 'f', -1, 64))
	w.stages.Run(w.ctx, Invocation{
		Command: command,
		LogPath: filepath.Join(entry.dir, "logs", name[:len(name)-len(".json")]+".log"),
		Timeout: w.config.Timeouts[run.Rehearse],
	})
}

func nextTrial(dir string, revision int) int {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 1
	}
	highest := 0
	for _, entry := range entries {
		match := trialName.FindStringSubmatch(entry.Name())
		if match == nil || match[1] != strconv.Itoa(revision) {
			continue
		}
		if number, _ := strconv.Atoi(match[2]); number > highest {
			highest = number
		}
	}
	return highest + 1
}
