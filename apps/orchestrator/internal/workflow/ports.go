package workflow

import (
	"context"
	"time"

	"infrared/orchestrator/internal/onboarding"
	"infrared/orchestrator/internal/run"
)

type Invocation struct {
	Command []string
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
	List(dir string) ([]run.Artifact, error)
	Read(dir, name string, limit int64) ([]byte, error)
	ReadObject(path string) (map[string]any, error)
	ReadCatalogOffer(path string) (onboarding.Catalog, error)
	ReadProject(path string) (onboarding.Project, error)
}

type Store interface {
	LoadAll() ([]*run.Run, error)
	Create(id string) (string, error)
	DirOf(id string) string
	Save(doc *run.Run) error
}
