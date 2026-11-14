package httpapi_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"infrared/orchestrator/internal/adapters/httpapi"
	"infrared/orchestrator/internal/onboarding"
	"infrared/orchestrator/internal/profile"
	"infrared/orchestrator/internal/run"
	"infrared/orchestrator/internal/workflow"
)

type fakeRuns struct {
	err         error
	listedLimit int
	listedFor   string
	eventsAfter int
	decided     run.Event
	artifacts   []run.Artifact
	artifact    []byte
	fileErr     error
	answers     *onboarding.Answers
	started     bool
	loggedStep  run.Step
	loggedAfter int64
	saved       *profile.Profile
	trial       *workflow.TrialProfile
}

func (f *fakeRuns) Onboarding() (onboarding.Setup, error) {
	return onboarding.Setup{Connections: onboarding.Connections, Providers: []string{"aws"}, Projects: []onboarding.Project{}}, f.err
}

func (f *fakeRuns) Start(project string, answers *onboarding.Answers) (run.Run, error) {
	f.started, f.answers = true, answers
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

func (f *fakeRuns) ListFiles(id string) ([]run.Artifact, error) {
	if f.artifacts == nil {
		return []run.Artifact{}, f.fileErr
	}
	return f.artifacts, f.fileErr
}

func (f *fakeRuns) ReadLog(id string, step run.Step, after int64) (workflow.LogChunk, error) {
	f.loggedStep, f.loggedAfter = step, after
	return workflow.LogChunk{Path: "logs/3-investigate.log", Text: "reading ec2\n", Next: after + 12, Running: true}, f.err
}

func TestALogChunkIsReadForAStepFromAnOffset(t *testing.T) {
	runs := &fakeRuns{}
	recorder := send(t, runs, "GET", "/runs/run-startup-0001/logs?step=investigate&after=30", "")
	if recorder.Code != http.StatusOK || runs.loggedStep != run.Investigate || runs.loggedAfter != 30 {
		t.Fatalf("%d, step %q after %d: %s", recorder.Code, runs.loggedStep, runs.loggedAfter, recorder.Body)
	}
	var chunk workflow.LogChunk
	json.Unmarshal(recorder.Body.Bytes(), &chunk)
	if chunk.Text != "reading ec2\n" || chunk.Next != 42 || !chunk.Running {
		t.Fatalf("chunk %+v", chunk)
	}
}

func TestALogRequestNeedsAStepWithALogAndAValidOffset(t *testing.T) {
	for _, path := range []string{"/runs/x/logs", "/runs/x/logs?step=present", "/runs/x/logs?step=nope", "/runs/x/logs?step=extract&after=-1", "/runs/x/logs?step=extract&after=a"} {
		if recorder := send(t, &fakeRuns{}, "GET", path, ""); recorder.Code != http.StatusBadRequest {
			t.Errorf("%s answered %d", path, recorder.Code)
		}
	}
}

func (f *fakeRuns) Retry(id string) (run.Run, error) {
	if id == "run-busy" {
		return run.Run{}, workflow.ErrProjectBusy
	}
	resumed := run.Run{}
	resumed.ID = id
	return resumed, nil
}

func (f *fakeRuns) BuildPlan(id, candidate string) (string, error) {
	if candidate == "nope" {
		return "", workflow.ErrUnknownCandidate
	}
	return "states.0." + candidate + ".json", nil
}

func (f *fakeRuns) Rehearse(id string, trial workflow.TrialProfile) (workflow.TrialStarted, error) {
	f.trial = &trial
	return workflow.TrialStarted{File: "rehearsal.1.trial-1.json", Candidate: "managed_services"}, f.err
}

func TestATrialRehearsalIsAcceptedAndNamesItsFile(t *testing.T) {
	runs := &fakeRuns{}
	recorder := send(t, runs, "POST", "/runs/run-1/rehearsals", `{"requests_per_second":80,"phase_seconds":20}`)
	if recorder.Code != http.StatusAccepted || runs.trial == nil || runs.trial.RequestsPerSecond != 80 || runs.trial.PhaseSeconds != 20 {
		t.Fatalf("%d %s", recorder.Code, recorder.Body)
	}
	if !strings.Contains(recorder.Body.String(), `"file":"rehearsal.1.trial-1.json"`) {
		t.Fatalf("body %s", recorder.Body)
	}
}

func TestATrialIsRefusedWithTheRightStatus(t *testing.T) {
	cases := []struct {
		err    error
		status int
	}{
		{fmt.Errorf("%w: x", workflow.ErrNoLayout), http.StatusConflict},
		{fmt.Errorf("%w: x", workflow.ErrTrialRunning), http.StatusConflict},
		{fmt.Errorf("%w: x", workflow.ErrInvalidTrial), http.StatusBadRequest},
		{fmt.Errorf("%w: run x", workflow.ErrNotFound), http.StatusNotFound},
	}
	for _, c := range cases {
		if recorder := send(t, &fakeRuns{err: c.err}, "POST", "/runs/x/rehearsals", `{"requests_per_second":10,"phase_seconds":15}`); recorder.Code != c.status {
			t.Errorf("%v answered %d, want %d", c.err, recorder.Code, c.status)
		}
	}
}

func (f *fakeRuns) Profile() (profile.Profile, error) {
	if f.saved != nil {
		return *f.saved, nil
	}
	return profile.Default(), f.err
}

func (f *fakeRuns) SaveProfile(saved profile.Profile) error {
	if err := profile.Check(saved); err != nil {
		return err
	}
	f.saved = &saved
	return nil
}

func TestTheProfileIsReadAndSaved(t *testing.T) {
	runs := &fakeRuns{}
	read := send(t, runs, "GET", "/profile", "")
	if read.Code != http.StatusOK || !strings.Contains(read.Body.String(), `"focus":"cost"`) {
		t.Fatalf("read %d %s", read.Code, read.Body)
	}
	body := `{"criteria":{"focus":"zone","market":"fr"},"onprem":{"wanted":false}}`
	if saved := send(t, runs, "PUT", "/profile", body); saved.Code != http.StatusOK || runs.saved == nil || runs.saved.Criteria.Market != "fr" {
		t.Fatalf("save %d %s", saved.Code, saved.Body)
	}
}

func TestABadProfileIsRefusedWith400(t *testing.T) {
	for _, body := range []string{
		`{"criteria":{"focus":"speed"},"onprem":{"wanted":false}}`,
		`{"criteria":{},"onprem":{"wanted":false},"extra":1}`,
		`not json`,
	} {
		runs := &fakeRuns{}
		if recorder := send(t, runs, "PUT", "/profile", body); recorder.Code != http.StatusBadRequest || runs.saved != nil {
			t.Errorf("%s: %d", body, recorder.Code)
		}
	}
}

func (f *fakeRuns) ReadFile(id, name string) ([]byte, error) {
	if f.artifact == nil {
		return []byte(`{"components":[]}`), f.fileErr
	}
	return f.artifact, f.fileErr
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
		{"GET", "/onboarding", "", http.StatusOK},
		{"GET", "/runs", "", http.StatusOK},
		{"POST", "/runs", `{"project": "startup"}`, http.StatusCreated},
		{"GET", "/runs/run-startup-0001", "", http.StatusOK},
		{"GET", "/runs/run-startup-0001/events?after=3", "", http.StatusOK},
		{"POST", "/runs/run-startup-0001/decisions", approval, http.StatusCreated},
		{"GET", "/runs/run-startup-0001/files", "", http.StatusOK},
		{"GET", "/runs/run-startup-0001/files/infra.json", "", http.StatusOK},
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

func TestArtifactFilesAreListedAndServed(t *testing.T) {
	runs := &fakeRuns{
		artifacts: []run.Artifact{{Path: "infra.json", Size: 17}},
		artifact:  []byte(`{"components":[]}`),
	}
	list := send(t, runs, "GET", "/runs/run-startup-0001/files", "")
	if list.Code != http.StatusOK || strings.TrimSpace(list.Body.String()) != `[{"path":"infra.json","size":17}]` {
		t.Fatalf("list = %d %s", list.Code, list.Body)
	}

	file := send(t, runs, "GET", "/runs/run-startup-0001/files/infra.json", "")
	if file.Code != http.StatusOK || file.Body.String() != `{"components":[]}` {
		t.Fatalf("file = %d %s", file.Code, file.Body)
	}
	if file.Header().Get("Content-Type") != "application/json" {
		t.Fatalf("file content-type %q", file.Header().Get("Content-Type"))
	}
}

func TestEmptyArtifactListsAreAnArray(t *testing.T) {
	recorder := send(t, &fakeRuns{}, "GET", "/runs/run-startup-0001/files", "")
	if strings.TrimSpace(recorder.Body.String()) != "[]" {
		t.Fatalf("body %q, want []", recorder.Body)
	}
}

func TestArtifactErrorsMapToStatuses(t *testing.T) {
	cases := []struct {
		err    error
		status int
	}{
		{fmt.Errorf("%w: artifact", workflow.ErrNotFound), http.StatusNotFound},
		{run.ErrArtifactTooLarge, http.StatusRequestEntityTooLarge},
	}
	for _, c := range cases {
		recorder := send(t, &fakeRuns{fileErr: c.err}, "GET", "/runs/run-startup-0001/files/infra.json", "")
		var body map[string]string
		json.Unmarshal(recorder.Body.Bytes(), &body)
		if recorder.Code != c.status || body["error"] != c.err.Error() {
			t.Errorf("%v answered %d %v, want %d with the reason", c.err, recorder.Code, body, c.status)
		}
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

func TestStartPassesTheOnboardingAnswers(t *testing.T) {
	runs := &fakeRuns{}
	recorder := send(t, runs, "POST", "/runs", `{"project": "startup", "onboarding": {"connection": "floci", "targets": ["aws"], "onprem": {"wanted": true}}}`)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("%d: %s", recorder.Code, recorder.Body)
	}
	if runs.answers == nil || runs.answers.Connection != "floci" || len(runs.answers.Targets) != 1 || !runs.answers.Onprem.Wanted {
		t.Fatalf("answers reached the workflow as %+v", runs.answers)
	}
}

func TestStartWithoutOnboardingPassesNoAnswers(t *testing.T) {
	runs := &fakeRuns{}
	send(t, runs, "POST", "/runs", `{"project": "startup"}`)
	if !runs.started || runs.answers != nil {
		t.Fatalf("started %v with answers %+v", runs.started, runs.answers)
	}
}

func TestAnUnknownOnboardingFieldIsRefusedBeforeTheWorkflow(t *testing.T) {
	runs := &fakeRuns{}
	recorder := send(t, runs, "POST", "/runs", `{"project": "startup", "onboarding": {"connection": "floci", "targets": ["aws"], "region": "eu"}}`)
	if recorder.Code != http.StatusBadRequest || runs.started {
		t.Fatalf("%d, started %v", recorder.Code, runs.started)
	}
}

func TestInvalidOnboardingAnswersAre400WithTheReason(t *testing.T) {
	err := fmt.Errorf("%w: gcp is forbidden by the project", onboarding.ErrInvalid)
	recorder := send(t, &fakeRuns{err: err}, "POST", "/runs", `{"project": "startup", "onboarding": {"connection": "floci", "targets": ["gcp"]}}`)
	var body map[string]string
	json.Unmarshal(recorder.Body.Bytes(), &body)
	if recorder.Code != http.StatusBadRequest || body["error"] != err.Error() {
		t.Fatalf("%d %v", recorder.Code, body)
	}
}

func TestTheOnboardingSetupIsServedAsJSON(t *testing.T) {
	recorder := send(t, &fakeRuns{}, "GET", "/onboarding", "")
	var setup struct {
		Connections []struct{ ID, Label string } `json:"connections"`
		Providers   []string                     `json:"providers"`
		Onprem      *bool                        `json:"onprem"`
		Projects    []any                        `json:"projects"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &setup); err != nil {
		t.Fatal(err)
	}
	if len(setup.Connections) != 1 || setup.Connections[0].ID != "floci" || setup.Onprem == nil || setup.Projects == nil {
		t.Fatalf("setup %s", recorder.Body)
	}
}

func TestStartWithNoProjectLeavesTheCompanyToTheWorkflowAndCarriesIntents(t *testing.T) {
	runs := &fakeRuns{}
	recorder := send(t, runs, "POST", "/runs", `{"onboarding": {"connection": "floci", "targets": ["aws"], "applications": [{"id": "billing", "users_now": 1, "users_expected": 2, "at_month": 12, "intent": "Move to the EU"}]}}`)
	if recorder.Code != http.StatusCreated || !runs.started || runs.answers == nil || runs.answers.Apps[0].Intent != "Move to the EU" {
		t.Fatalf("%d: %s, answers %+v", recorder.Code, recorder.Body, runs.answers)
	}
}

func TestACandidatesPlanIsBuiltOnDemandForReview(t *testing.T) {
	recorder := send(t, &fakeRuns{}, "POST", "/runs/run-company-0002/plans", `{"candidate":"managed_services"}`)
	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), "states.0.managed_services.json") {
		t.Fatalf("%d: %s", recorder.Code, recorder.Body)
	}
	for body, want := range map[string]int{`{"candidate":"nope"}`: http.StatusBadRequest, `{}`: http.StatusBadRequest, `not json`: http.StatusBadRequest} {
		if got := send(t, &fakeRuns{}, "POST", "/runs/run-company-0002/plans", body).Code; got != want {
			t.Fatalf("%s: %d, want %d", body, got, want)
		}
	}
}
