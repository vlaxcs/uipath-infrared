package workflow

import (
	"errors"
	"fmt"
	"io/fs"
	"regexp"

	"infrared/orchestrator/internal/run"
)

const MaxArtifactBytes = 16 << 20

var artifactName = regexp.MustCompile(`^(infra|findings|candidates\.\d+|feedback\.\d+|result\.\d+|rehearsal\.\d+)\.json$`)

func artifactAllowed(name string) bool {
	return artifactName.MatchString(name)
}

func (w *Workflow) ListFiles(id string) ([]run.Artifact, error) {
	entry, err := w.lookup(id)
	if err != nil {
		return nil, err
	}
	files, err := w.files.List(entry.dir)
	if err != nil {
		return nil, err
	}
	artifacts := make([]run.Artifact, 0, len(files))
	for _, file := range files {
		if artifactAllowed(file.Path) {
			artifacts = append(artifacts, file)
		}
	}
	return artifacts, nil
}

func (w *Workflow) ReadFile(id, name string) ([]byte, error) {
	entry, err := w.lookup(id)
	if err != nil {
		return nil, err
	}
	if !artifactAllowed(name) {
		return nil, fmt.Errorf("%w: artifact %s", ErrNotFound, name)
	}
	data, err := w.files.Read(entry.dir, name, MaxArtifactBytes)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, fmt.Errorf("%w: artifact %s", ErrNotFound, name)
	}
	return data, err
}
