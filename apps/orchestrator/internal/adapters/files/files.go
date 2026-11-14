package files

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"infrared/orchestrator/internal/run"
)

type Local struct{}

func (Local) Hash(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	digest := sha256.New()
	if _, err := io.Copy(digest, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(digest.Sum(nil)), nil
}

func (Local) Copy(source, destination string) error {
	data, err := os.ReadFile(source)
	if err != nil {
		return err
	}
	return os.WriteFile(destination, data, 0o644)
}

func (Local) List(dir string) ([]run.Artifact, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	artifacts := make([]run.Artifact, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			return nil, err
		}
		if !info.Mode().IsRegular() {
			continue
		}
		artifacts = append(artifacts, run.Artifact{Path: entry.Name(), Size: info.Size()})
	}
	return artifacts, nil
}

func (Local) Read(dir, name string, limit int64) ([]byte, error) {
	if name == "" || name == "." || name == ".." || filepath.Base(name) != name || strings.ContainsAny(name, `/\`) {
		return nil, fs.ErrNotExist
	}
	path := filepath.Join(dir, name)
	info, err := os.Lstat(path)
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() {
		return nil, fs.ErrNotExist
	}
	if info.Size() > limit {
		return nil, run.ErrArtifactTooLarge
	}
	return os.ReadFile(path)
}

func (Local) CheckObject(path string) error {
	var object map[string]json.RawMessage
	if err := readJSON(path, &object); err != nil {
		return err
	}
	if object == nil {
		return errors.New("is not a JSON object")
	}
	return nil
}

type resultDocument struct {
	Candidates []struct {
		ID              string   `json:"id"`
		Source          string   `json:"source"`
		Feasible        bool     `json:"feasible"`
		Rank            *int     `json:"rank"`
		AvailabilityPct *float64 `json:"availability_pct"`
		Risk            *float64 `json:"risk"`
		Cost            struct {
			RunEURMonthNow *float64 `json:"run_eur_month_now"`
		} `json:"cost"`
		Violations []struct {
			Constraint string `json:"constraint"`
		} `json:"violations"`
	} `json:"candidates"`
}

func (Local) ReadResult(path string) (run.Result, error) {
	var document resultDocument
	if err := readJSON(path, &document); err != nil {
		return run.Result{}, err
	}
	result := run.Result{Candidates: make([]run.CandidateOutcome, 0, len(document.Candidates))}
	for _, candidate := range document.Candidates {
		constraints := make([]string, 0, len(candidate.Violations))
		for _, violation := range candidate.Violations {
			constraints = append(constraints, violation.Constraint)
		}
		result.Candidates = append(result.Candidates, run.CandidateOutcome{
			ID: candidate.ID, Source: candidate.Source, Feasible: candidate.Feasible, Constraints: constraints,
			Rank: candidate.Rank, MonthlyEUR: candidate.Cost.RunEURMonthNow, AvailabilityPct: candidate.AvailabilityPct, Risk: candidate.Risk,
		})
	}
	return result, nil
}

func (Local) ReadCandidatesRevision(path string) (int, error) {
	var document struct {
		Revision int `json:"revision"`
	}
	err := readJSON(path, &document)
	return document.Revision, err
}

func (Local) ReadRehearsalReason(path string) (string, error) {
	var document struct {
		Decision *struct {
			Reason string `json:"reason"`
		} `json:"x_decision"`
		Verdict struct {
			Reason string `json:"reason"`
		} `json:"verdict"`
	}
	if err := readJSON(path, &document); err != nil {
		return "", err
	}
	if document.Decision != nil && document.Decision.Reason != "" {
		return document.Decision.Reason, nil
	}
	if document.Verdict.Reason == "" {
		return "", errors.New("has neither x_decision.reason nor verdict.reason")
	}
	return document.Verdict.Reason, nil
}

func (Local) WriteJSON(path string, value any) error {
	return WriteAtomically(path, value)
}

func WriteAtomically(path string, value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	temporary, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".*.tmp")
	if err != nil {
		return err
	}
	_, writeErr := temporary.Write(append(data, '\n'))
	closeErr := temporary.Close()
	if err := errors.Join(writeErr, closeErr); err != nil {
		os.Remove(temporary.Name())
		return err
	}
	return os.Rename(temporary.Name(), path)
}

func readJSON(path string, into any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, into)
}
