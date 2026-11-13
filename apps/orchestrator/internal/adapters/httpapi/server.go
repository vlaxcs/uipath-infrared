package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"infrared/orchestrator/internal/run"
	"infrared/orchestrator/internal/workflow"
)

const (
	maxBodyBytes = 64 << 10
	defaultLimit = 50
	maxLimit     = 200
)

type Runs interface {
	Start(project string) (run.Run, error)
	Get(id string) (run.Run, error)
	EventsAfter(id string, seq int) ([]run.Event, error)
	List(project string, limit int) []run.Summary
	Decide(id string, event run.Event) (run.Event, error)
}

func Handler(runs Runs) http.Handler {
	api := &api{runs: runs}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /runs", api.list)
	mux.HandleFunc("POST /runs", api.start)
	mux.HandleFunc("GET /runs/{id}", api.get)
	mux.HandleFunc("GET /runs/{id}/events", api.events)
	mux.HandleFunc("POST /runs/{id}/decisions", api.decide)
	return mux
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

func (a *api) start(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Project string `json:"project"`
	}
	if !decode(w, r, &body) {
		return
	}
	started, err := a.runs.Start(body.Project)
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
	case errors.Is(err, workflow.ErrProjectBusy), errors.Is(err, run.ErrGateNotOpen):
		status = http.StatusConflict
	case errors.Is(err, run.ErrInvalidDecision):
		status = http.StatusBadRequest
	case errors.Is(err, workflow.ErrLayoutNotFeasible):
		status = http.StatusUnprocessableEntity
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
