package workflow

import (
	"context"
	"time"

	"infrared/orchestrator/internal/run"
)

type Invocation struct {
	Command []string
	Dir     string
	LogPath string
	Timeout time.Duration
}

type Outcome struct {
	ExitCode   int
	StderrTail string
	TimedOut   bool
}

type Stages interface {
	Run(ctx context.Context, invocation Invocation) (Outcome, error)
}

type Contracts interface {
	Check(contract, path string) error
}

type Files interface {
	Hash(path string) (string, error)
	Copy(source, destination string) error
	CheckObject(path string) error
	ReadResult(path string) (run.Result, error)
	ReadCandidatesRevision(path string) (int, error)
	ReadRehearsalReason(path string) (string, error)
	WriteJSON(path string, value any) error
}

type Store interface {
	LoadAll() ([]*run.Run, error)
	Create(id string) (string, error)
	DirOf(id string) string
	Save(doc *run.Run) error
}
