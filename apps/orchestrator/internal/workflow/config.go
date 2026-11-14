package workflow

import (
	"context"
	"time"

	"infrared/orchestrator/internal/run"
)

type Commands struct {
	Extract []string
	Agent   []string
	Engine  []string
	Sandbox []string
	States  []string
}

type Config struct {
	Commands     Commands
	ProjectsDir  string
	CatalogPath  string
	MaxRevisions int
	Timeouts     map[run.Step]time.Duration
	FlociURL     string
	Probe        func(ctx context.Context, url string) bool
}

const StatesTimeout = time.Minute

var DefaultTimeouts = map[run.Step]time.Duration{
	run.Extract:     10 * time.Minute,
	run.Investigate: 30 * time.Minute,
	run.Propose:     15 * time.Minute,
	run.Evaluate:    2 * time.Minute,
	run.Rehearse:    20 * time.Minute,
}
