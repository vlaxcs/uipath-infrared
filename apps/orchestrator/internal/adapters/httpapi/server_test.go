package httpapi_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"infrared/orchestrator/internal/adapters/httpapi"
	"infrared/orchestrator/internal/run"
	"infrared/orchestrator/internal/workflow"
)

type fakeRuns struct {
	err         error
	listedLimit int
	listedFor   string
	eventsAfter int
	decided     run.Event
}

func (f *fakeRuns) Start(project string) (run.Run, error) {
	return run.Run{Summary: run.Summary{ID: "run-" + project + "-0001", Project: project}}, f.err
}

func (f *fakeRuns) Get(id string) (run.Run, error) {
	return run.Run{Summary: run.Summary{ID: id}, Events: []run.Event{{Seq: 1}}}, f.err
}

func (f *fakeRuns) EventsAfter(id string, seq int) ([]run.Event, error) {
	f.eventsAfter = seq
	return []run.Event{}, f.err
}

func (f *fakeRuns) List(project string, limit int) []run.Summary {
	f.listedFor, f.listedLimit = project, limit
	return []run.Summary{{ID: "run-startup-0001"}}
}

func (f *fakeRuns) Decide(id string, event run.Event) (run.Event, error) {
	f.decided = event
	event.Seq = 9
	return event, f.err
}

func send(t *testing.T, runs *fakeRuns, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	httpapi.Handler(runs).ServeHTTP(recorder, httptest.NewRequest(method, path, strings.NewReader(body)))
	return recorder
}

const approval = `{"step": "rehearse", "status": "approved", "actor": {"kind": "human", "id": "cto", "surface": "slack"}, "decision": {"kind": "approve_plan", "reason": "go"}}`

func TestRoutesAnswerWithTheirStatus(t *testing.T) {
	cases := []struct {
		method, path, body string
		status             int
	}{
		{"GET", "/runs", "", http.StatusOK},
		{"POST", "/runs", `{"project": "startup"}`, http.StatusCreated},
		{"GET", "/runs/run-startup-0001", "", http.StatusOK},
		{"GET", "/runs/run-startup-0001/events?after=3", "", http.StatusOK},
		{"POST", "/runs/run-startup-0001/decisions", approval, http.StatusCreated},
		{"DELETE", "/runs/run-startup-0001", "", http.StatusMethodNotAllowed},
	}
	for _, c := range cases {
		recorder := send(t, &fakeRuns{}, c.method, c.path, c.body)
		if recorder.Code != c.status {
			t.Errorf("%s %s = %d, want %d: %s", c.method, c.path, recorder.Code, c.status, recorder.Body)
		}
		if c.status < 400 && recorder.Header().Get("Content-Type") != "application/json" {
			t.Errorf("%s %s answers %q", c.method, c.path, recorder.Header().Get("Content-Type"))
		}
	}
}

func TestEmptyEventListsAreAnArray(t *testing.T) {
	recorder := send(t, &fakeRuns{}, "GET", "/runs/run-startup-0001/events?after=0", "")
	if strings.TrimSpace(recorder.Body.String()) != "[]" {
		t.Fatalf("body %q, want []", recorder.Body)
	}
}

func TestWorkflowErrorsMapToStatuses(t *testing.T) {
	cases := []struct {
		err    error
		status int
	}{
		{fmt.Errorf("%w: run x", workflow.ErrNotFound), http.StatusNotFound},
		{fmt.Errorf("%w: x", workflow.ErrUnknownProject), http.StatusNotFound},
		{fmt.Errorf("%w: x", workflow.ErrProjectBusy), http.StatusConflict},
		{fmt.Errorf("%w: x", run.ErrGateNotOpen), http.StatusConflict},
		{fmt.Errorf("%w: x", run.ErrInvalidDecision), http.StatusBadRequest},
		{fmt.Errorf("%w: x", workflow.ErrLayoutNotFeasible), http.StatusUnprocessableEntity},
		{fmt.Errorf("disk full"), http.StatusInternalServerError},
	}
	for _, c := range cases {
		recorder := send(t, &fakeRuns{err: c.err}, "POST", "/runs/run-startup-0001/decisions", approval)
		var body map[string]string
		json.Unmarshal(recorder.Body.Bytes(), &body)
		if recorder.Code != c.status || body["error"] != c.err.Error() {
			t.Errorf("%v answered %d %v, want %d with the reason", c.err, recorder.Code, body, c.status)
		}
	}
}

func TestBadRequestsAreRefusedBeforeTheWorkflow(t *testing.T) {
	cases := []struct {
		name, method, path, body string
		status                   int
	}{
		{"unknown field", "POST", "/runs/x/decisions", strings.Replace(approval, `"step"`, `"x_note": 1, "step"`, 1), http.StatusBadRequest},
		{"seq set by the caller", "POST", "/runs/x/decisions", strings.Replace(approval, `"step"`, `"seq": 4, "step"`, 1), http.StatusBadRequest},
		{"not JSON", "POST", "/runs", `project=startup`, http.StatusBadRequest},
		{"two JSON values", "POST", "/runs", `{"project": "a"} {"project": "b"}`, http.StatusBadRequest},
		{"body over 64 KiB", "POST", "/runs", `{"project": "` + strings.Repeat("a", 70<<10) + `"}`, http.StatusRequestEntityTooLarge},
		{"negative after", "GET", "/runs/x/events?after=-1", "", http.StatusBadRequest},
		{"after not a number", "GET", "/runs/x/events?after=two", "", http.StatusBadRequest},
		{"limit over the cap", "GET", "/runs?limit=201", "", http.StatusBadRequest},
		{"limit zero", "GET", "/runs?limit=0", "", http.StatusBadRequest},
	}
	for _, c := range cases {
		runs := &fakeRuns{}
		recorder := send(t, runs, c.method, c.path, c.body)
		if recorder.Code != c.status {
			t.Errorf("%s: %d, want %d: %s", c.name, recorder.Code, c.status, recorder.Body)
		}
		if runs.decided.Decision != nil {
			t.Errorf("%s: reached the workflow", c.name)
		}
	}
}

func TestListDefaultsAndFilters(t *testing.T) {
	runs := &fakeRuns{}
	send(t, runs, "GET", "/runs", "")
	if runs.listedLimit != 50 || runs.listedFor != "" {
		t.Fatalf("default list asked for %d runs of %q", runs.listedLimit, runs.listedFor)
	}
	send(t, runs, "GET", "/runs?project=startup&limit=200", "")
	if runs.listedLimit != 200 || runs.listedFor != "startup" {
		t.Fatalf("filtered list asked for %d runs of %q", runs.listedLimit, runs.listedFor)
	}
}

func TestTheDecisionBodyReachesTheWorkflowWhole(t *testing.T) {
	runs := &fakeRuns{}
	send(t, runs, "POST", "/runs/run-startup-0001/decisions", approval)
	got := runs.decided
	if got.Step != run.Rehearse || got.Actor.Surface != "slack" || got.Decision.Kind != run.ApprovePlan || got.Decision.Reason != "go" {
		t.Fatalf("decided %+v", got)
	}
}
