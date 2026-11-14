package workflow

import (
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"

	"infrared/orchestrator/internal/run"
)

const MaxLogChunkBytes = 64 << 10

type LogChunk struct {
	Path    string `json:"path"`
	Text    string `json:"text"`
	Next    int64  `json:"next"`
	Running bool   `json:"running"`
}

func (w *Workflow) ReadLog(id string, step run.Step, after int64) (LogChunk, error) {
	entry, err := w.lookup(id)
	if err != nil {
		return LogChunk{}, err
	}
	entry.mu.Lock()
	seq, running := latestStart(entry.doc, step)
	entry.mu.Unlock()
	if seq == 0 {
		return LogChunk{}, fmt.Errorf("%w: %s has not started", ErrNotFound, step)
	}
	name := fmt.Sprintf("logs/%d-%s.log", seq, step)
	data, size, err := w.files.ReadFrom(filepath.Join(entry.dir, filepath.FromSlash(name)), after, MaxLogChunkBytes)
	if errors.Is(err, fs.ErrNotExist) {
		return LogChunk{Path: name, Next: after, Running: running}, nil
	}
	if err != nil {
		return LogChunk{}, err
	}
	if int64(len(data)) == MaxLogChunkBytes && after+int64(len(data)) < size {
		if cut := bytes.LastIndexByte(data, '\n'); cut >= 0 {
			data = data[:cut+1]
		}
	}
	next := after + int64(len(data))
	if after > size {
		next = size
	}
	return LogChunk{Path: name, Text: string(data), Next: next, Running: running}, nil
}

func latestStart(doc *run.Run, step run.Step) (int, bool) {
	for i := len(doc.Events) - 1; i >= 0; i-- {
		event := doc.Events[i]
		if event.Step != step {
			continue
		}
		if event.Status == run.Started {
			return event.Seq, true
		}
		for j := i - 1; j >= 0; j-- {
			if doc.Events[j].Step == step && doc.Events[j].Status == run.Started {
				return doc.Events[j].Seq, false
			}
		}
		return 0, false
	}
	return 0, false
}
