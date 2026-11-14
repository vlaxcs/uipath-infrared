package files

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"infrared/orchestrator/internal/onboarding"
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

func (Local) ReadFrom(path string, offset, limit int64) ([]byte, int64, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, 0, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return nil, 0, err
	}
	if offset >= info.Size() {
		return nil, info.Size(), nil
	}
	buffer := make([]byte, min(limit, info.Size()-offset))
	read, err := file.ReadAt(buffer, offset)
	if err != nil && !errors.Is(err, io.EOF) {
		return nil, 0, err
	}
	return buffer[:read], info.Size(), nil
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
	Winner     string `json:"winner"`
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
	result := run.Result{Winner: document.Winner, Candidates: make([]run.CandidateOutcome, 0, len(document.Candidates))}
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

func (Local) ReadObject(path string) (map[string]any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	var object map[string]any
	if err := decoder.Decode(&object); err != nil {
		return nil, fmt.Errorf("%s: %w", filepath.Base(path), err)
	}
	if object == nil {
		return nil, fmt.Errorf("%s: is not a JSON object", filepath.Base(path))
	}
	return object, nil
}

func (Local) ReadCatalogOffer(path string) (onboarding.Catalog, error) {
	var document struct {
		Options []struct {
			Provider string `json:"provider"`
		} `json:"options"`
		OnpremPlatforms []json.RawMessage `json:"onprem_platforms"`
	}
	if err := readJSON(path, &document); err != nil {
		return onboarding.Catalog{}, fmt.Errorf("%s: %w", filepath.Base(path), err)
	}
	offer := onboarding.Catalog{Providers: []string{}, Onprem: len(document.OnpremPlatforms) > 0}
	for _, option := range document.Options {
		if option.Provider == onboarding.OnpremProvider {
			offer.Onprem = true
			continue
		}
		if option.Provider != "" && !slices.Contains(offer.Providers, option.Provider) {
			offer.Providers = append(offer.Providers, option.Provider)
		}
	}
	slices.Sort(offer.Providers)
	return offer, nil
}

func (Local) ReadProject(path string) (onboarding.Project, error) {
	var document struct {
		Description     string `json:"description"`
		HardConstraints struct {
			ForbiddenProviders []string `json:"forbidden_providers"`
		} `json:"hard_constraints"`
		Projects []struct {
			ID     string   `json:"id"`
			Name   string   `json:"name"`
			Stacks []string `json:"stacks"`
			Users  struct {
				Metric   string  `json:"metric"`
				Current  float64 `json:"current"`
				Expected []struct {
					Month int     `json:"month"`
					Base  float64 `json:"base"`
				} `json:"expected"`
			} `json:"users"`
		} `json:"projects"`
	}
	if err := readJSON(path, &document); err != nil {
		return onboarding.Project{}, fmt.Errorf("%s: %w", filepath.Base(path), err)
	}
	summaries, err := readSummaries(strings.TrimSuffix(path, ".forecast.json") + ".projects.json")
	if err != nil {
		return onboarding.Project{}, err
	}
	apps := make([]onboarding.Application, 0, len(document.Projects))
	for _, project := range document.Projects {
		users := onboarding.ProjectUsers{Metric: project.Users.Metric, Current: int(project.Users.Current)}
		for _, row := range project.Users.Expected {
			if row.Month >= users.AtMonth {
				users.AtMonth, users.Expected = row.Month, int(row.Base)
			}
		}
		name := project.Name
		if name == "" {
			name = project.ID
		}
		apps = append(apps, onboarding.Application{ID: project.ID, Name: name, Summary: summaries[project.ID], Stacks: project.Stacks, Users: users})
	}
	forbidden := document.HardConstraints.ForbiddenProviders
	if forbidden == nil {
		forbidden = []string{}
	}
	profile, err := readProjectProfile(strings.TrimSuffix(path, ".forecast.json") + ".project.json")
	if err != nil {
		return onboarding.Project{}, err
	}
	return onboarding.Project{Description: document.Description, ForbiddenProviders: forbidden, Profile: profile, Applications: apps}, nil
}

func readSummaries(path string) (map[string]string, error) {
	var document struct {
		Projects []struct {
			ID      string `json:"id"`
			Summary string `json:"summary"`
		} `json:"projects"`
	}
	err := readJSON(path, &document)
	if errors.Is(err, fs.ErrNotExist) {
		return map[string]string{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("%s: %w", filepath.Base(path), err)
	}
	summaries := make(map[string]string, len(document.Projects))
	for _, project := range document.Projects {
		summaries[project.ID] = project.Summary
	}
	return summaries, nil
}

func readProjectProfile(path string) (*onboarding.ProjectProfile, error) {
	var document struct {
		Name     string `json:"name"`
		Summary  string `json:"summary"`
		Business struct {
			Markets []string `json:"markets"`
		} `json:"business"`
		Environments []struct {
			Name string `json:"name"`
		} `json:"environments"`
		Users *struct {
			Metric  string `json:"metric"`
			Current struct {
				Value int `json:"value"`
			} `json:"current"`
			Expected []struct {
				Month int `json:"month"`
				Base  int `json:"base"`
			} `json:"expected"`
		} `json:"users"`
	}
	err := readJSON(path, &document)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("%s: %w", filepath.Base(path), err)
	}
	profile := &onboarding.ProjectProfile{Name: document.Name, Summary: document.Summary, Markets: document.Business.Markets, Environments: []string{}}
	if profile.Markets == nil {
		profile.Markets = []string{}
	}
	for _, environment := range document.Environments {
		profile.Environments = append(profile.Environments, environment.Name)
	}
	if users := document.Users; users != nil {
		summary := &onboarding.ProjectUsers{Metric: users.Metric, Current: users.Current.Value}
		for _, point := range users.Expected {
			if point.Month >= summary.AtMonth {
				summary.AtMonth, summary.Expected = point.Month, point.Base
			}
		}
		profile.Users = summary
	}
	return profile, nil
}
