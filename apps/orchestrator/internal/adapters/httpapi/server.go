package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"infrared/orchestrator/internal/onboarding"
	"infrared/orchestrator/internal/profile"
	"infrared/orchestrator/internal/run"
	"infrared/orchestrator/internal/workflow"
)

const (
	maxBodyBytes = 64 << 10
	defaultLimit = 50
	maxLimit     = 200
)

type Runs interface {
	Onboarding() (onboarding.Setup, error)
	Start(project string, answers *onboarding.Answers) (run.Run, error)
	Get(id string) (run.Run, error)
	EventsAfter(id string, seq int) ([]run.Event, error)
	List(project string, limit int) []run.Summary
	Decide(id string, event run.Event) (run.Event, error)
	ListFiles(id string) ([]run.Artifact, error)
	ReadFile(id, name string) ([]byte, error)
	ReadLog(id string, step run.Step, after int64) (workflow.LogChunk, error)
	Profile() (profile.Profile, error)
	SaveProfile(profile.Profile) error
	Rehearse(id string, trial workflow.TrialProfile) (workflow.TrialStarted, error)
	BuildPlan(id, candidate string) (string, error)
}

func Handler(runs Runs, allowedOrigins ...string) http.Handler {
	return withCORS(withDemoAuth(routes(runs)), allowedOrigins)
}

func routes(runs Runs) http.Handler {
	api := &api{runs: runs}
	seen := &presence{now: time.Now}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /integrations", seen.integrations)
	mux.HandleFunc("GET /onboarding", api.onboarding)
	mux.HandleFunc("GET /runs", api.list)
	mux.HandleFunc("POST /runs", api.start)
	mux.HandleFunc("GET /runs/{id}", api.get)
	mux.HandleFunc("GET /runs/{id}/events", api.events)
	mux.HandleFunc("POST /runs/{id}/decisions", api.decide)
	mux.HandleFunc("GET /runs/{id}/files", api.files)
	mux.HandleFunc("GET /runs/{id}/files/{name}", api.file)
	mux.HandleFunc("GET /runs/{id}/logs", api.logs)
	mux.HandleFunc("POST /runs/{id}/rehearsals", api.rehearse)
	mux.HandleFunc("POST /runs/{id}/plans", api.plan)
	mux.HandleFunc("GET /profile", api.profile)
	mux.HandleFunc("PUT /profile", api.saveProfile)
	return seen.observe(mux)
}

type api struct {
	runs Runs
}

func (a *api) list(w http.ResponseWriter, r *http.Request) {
	limit, err := boundedInt(r.URL.Query().Get("limit"), defaultLimit, 1, maxLimit)
	if err != nil {
		fail(w, http.StatusBadRequest, "limit must be an integer from 1 to 200")
		return
	}
	reply(w, http.StatusOK, a.runs.List(r.URL.Query().Get("project"), limit))
}

func (a *api) onboarding(w http.ResponseWriter, r *http.Request) {
	setup, err := a.runs.Onboarding()
	if err != nil {
		failWith(w, err)
		return
	}
	reply(w, http.StatusOK, setup)
}

func (a *api) start(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Project    string              `json:"project"`
		Onboarding *onboarding.Answers `json:"onboarding"`
	}
	if !decode(w, r, &body) {
		return
	}
	started, err := a.runs.Start(body.Project, body.Onboarding)
	if err != nil {
		failWith(w, err)
		return
	}
	reply(w, http.StatusCreated, started)
}

func (a *api) get(w http.ResponseWriter, r *http.Request) {
	found, err := a.runs.Get(r.PathValue("id"))
	if err != nil {
		failWith(w, err)
		return
	}
	reply(w, http.StatusOK, found)
}

func (a *api) events(w http.ResponseWriter, r *http.Request) {
	after, err := boundedInt(r.URL.Query().Get("after"), 0, 0, int(^uint(0)>>1))
	if err != nil {
		fail(w, http.StatusBadRequest, "after must be a non-negative integer")
		return
	}
	events, err := a.runs.EventsAfter(r.PathValue("id"), after)
	if err != nil {
		failWith(w, err)
		return
	}
	reply(w, http.StatusOK, events)
}

func (a *api) decide(w http.ResponseWriter, r *http.Request) {
	var event run.Event
	if !decode(w, r, &event) {
		return
	}
	if event.Seq != 0 || event.At != "" || event.Revision != 0 {
		fail(w, http.StatusBadRequest, "seq, at and revision are set by the orchestrator")
		return
	}
	appended, err := a.runs.Decide(r.PathValue("id"), event)
	if err != nil {
		failWith(w, err)
		return
	}
	reply(w, http.StatusCreated, appended)
}

func (a *api) files(w http.ResponseWriter, r *http.Request) {
	artifacts, err := a.runs.ListFiles(r.PathValue("id"))
	if err != nil {
		failWith(w, err)
		return
	}
	reply(w, http.StatusOK, artifacts)
}

func (a *api) file(w http.ResponseWriter, r *http.Request) {
	data, err := a.runs.ReadFile(r.PathValue("id"), r.PathValue("name"))
	if err != nil {
		failWith(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

var logSteps = map[run.Step]bool{run.Extract: true, run.Investigate: true, run.Propose: true, run.Evaluate: true, run.Rehearse: true}

func (a *api) logs(w http.ResponseWriter, r *http.Request) {
	step := run.Step(r.URL.Query().Get("step"))
	if !logSteps[step] {
		fail(w, http.StatusBadRequest, "step must be extract, investigate, propose, evaluate or rehearse")
		return
	}
	after, err := boundedInt(r.URL.Query().Get("after"), 0, 0, int(^uint(0)>>1))
	if err != nil {
		fail(w, http.StatusBadRequest, "after must be a non-negative integer")
		return
	}
	chunk, err := a.runs.ReadLog(r.PathValue("id"), step, int64(after))
	if err != nil {
		failWith(w, err)
		return
	}
	reply(w, http.StatusOK, chunk)
}

func (a *api) rehearse(w http.ResponseWriter, r *http.Request) {
	var trial workflow.TrialProfile
	if !decode(w, r, &trial) {
		return
	}
	started, err := a.runs.Rehearse(r.PathValue("id"), trial)
	if err != nil {
		failWith(w, err)
		return
	}
	reply(w, http.StatusAccepted, started)
}

func (a *api) profile(w http.ResponseWriter, r *http.Request) {
	saved, err := a.runs.Profile()
	if err != nil {
		failWith(w, err)
		return
	}
	reply(w, http.StatusOK, saved)
}

func (a *api) saveProfile(w http.ResponseWriter, r *http.Request) {
	var body profile.Profile
	if !decode(w, r, &body) {
		return
	}
	if err := a.runs.SaveProfile(body); err != nil {
		failWith(w, err)
		return
	}
	reply(w, http.StatusOK, body)
}

func decode(w http.ResponseWriter, r *http.Request, into any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(into); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			fail(w, http.StatusRequestEntityTooLarge, "the body is over 64 KiB")
			return false
		}
		fail(w, http.StatusBadRequest, "the body is not valid JSON for this route: "+err.Error())
		return false
	}
	if decoder.More() {
		fail(w, http.StatusBadRequest, "the body holds more than one JSON value")
		return false
	}
	return true
}

func failWith(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	switch {
	case errors.Is(err, workflow.ErrNotFound), errors.Is(err, workflow.ErrUnknownProject):
		status = http.StatusNotFound
	case errors.Is(err, workflow.ErrProjectBusy), errors.Is(err, run.ErrGateNotOpen), errors.Is(err, workflow.ErrNoLayout), errors.Is(err, workflow.ErrTrialRunning):
		status = http.StatusConflict
	case errors.Is(err, run.ErrInvalidDecision), errors.Is(err, onboarding.ErrInvalid), errors.Is(err, profile.ErrInvalid), errors.Is(err, workflow.ErrInvalidTrial):
		status = http.StatusBadRequest
	case errors.Is(err, workflow.ErrUnknownCandidate):
		status = http.StatusBadRequest
	case errors.Is(err, workflow.ErrLayoutNotFeasible), errors.Is(err, workflow.ErrNoPlan):
		status = http.StatusUnprocessableEntity
	case errors.Is(err, run.ErrArtifactTooLarge):
		status = http.StatusRequestEntityTooLarge
	}
	fail(w, status, err.Error())
}

func fail(w http.ResponseWriter, status int, reason string) {
	reply(w, status, map[string]string{"error": reason})
}

func reply(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}

func boundedInt(raw string, fallback, low, high int) (int, error) {
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < low || value > high {
		return 0, errors.New("out of range")
	}
	return value, nil
}

// plan builds a candidate's migration plan on demand and answers its file name.
func (a *api) plan(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Candidate string `json:"candidate"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil || body.Candidate == "" {
		fail(w, http.StatusBadRequest, "send {\"candidate\": \"<id>\"}")
		return
	}
	path, err := a.runs.BuildPlan(r.PathValue("id"), body.Candidate)
	if err != nil {
		failWith(w, err)
		return
	}
	reply(w, http.StatusOK, map[string]string{"path": path})
}
