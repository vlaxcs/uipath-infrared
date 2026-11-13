package store

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"infrared/orchestrator/internal/adapters/files"
	"infrared/orchestrator/internal/run"
)

const documentName = "run.json"

type Directory struct {
	root string
}

func Open(root string) (*Directory, error) {
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, err
	}
	return &Directory{root: root}, nil
}

func (d *Directory) DirOf(id string) string {
	return filepath.Join(d.root, id)
}

func (d *Directory) Create(id string) (string, error) {
	dir := d.DirOf(id)
	if err := os.Mkdir(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

func (d *Directory) Save(doc *run.Run) error {
	return files.WriteAtomically(filepath.Join(d.DirOf(doc.ID), documentName), doc)
}

func (d *Directory) LoadAll() ([]*run.Run, error) {
	entries, err := os.ReadDir(d.root)
	if err != nil {
		return nil, err
	}
	docs := make([]*run.Run, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		path := filepath.Join(d.root, entry.Name(), documentName)
		data, err := os.ReadFile(path)
		if errors.Is(err, fs.ErrNotExist) {
			return nil, fmt.Errorf("%s: a run directory without %s", filepath.Join(d.root, entry.Name()), documentName)
		}
		if err != nil {
			return nil, err
		}
		var doc run.Run
		if err := json.Unmarshal(data, &doc); err != nil {
			return nil, fmt.Errorf("%s: %w", path, err)
		}
		if doc.ID != entry.Name() || len(doc.Events) == 0 {
			return nil, fmt.Errorf("%s: id %q in directory %q, %d events", path, doc.ID, entry.Name(), len(doc.Events))
		}
		docs = append(docs, &doc)
	}
	return docs, nil
}
