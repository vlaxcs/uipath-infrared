package workflow_test

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"sync"
	"testing"
	"time"

	"infrared/orchestrator/internal/adapters/contracts"
	"infrared/orchestrator/internal/adapters/files"
	"infrared/orchestrator/internal/adapters/store"
	"infrared/orchestrator/internal/run"
	"infrared/orchestrator/internal/workflow"
)

type stage func(ctx context.Context, invocation workflow.Invocation) (workflow.Outcome, error)

type fakeStages struct {
	mu        sync.Mutex
	overrides map[string]stage
	calls     []string
}

func (f *fakeStages) Run(ctx context.Context, invocation workflow.Invocation) (workflow.Outcome, error) {
	name := stageName(invocation.Command)
	f.mu.Lock()
	f.calls = append(f.calls, name)
	override, found := f.overrides[name]
	f.mu.Unlock()
	if found {
		return override(ctx, invocation)
	}
	return defaultStage(name)(ctx, invocation)
}

func (f *fakeStages) callsTo(name string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	count := 0
	for _, call := range f.calls {
		if call == name {
			count++
		}
	}
	return count
}

func stageName(command []string) string {
	if command[0] == "agent" {
		return command[1]
	}
	return command[0]
}

var revisionInName = regexp.MustCompile(`\.(\d+)\.json$`)

func defaultStage(name string) stage {
	return func(_ context.Context, invocation workflow.Invocation) (workflow.Outcome, error) {
		out := argument(invocation.Command, "--out")
		switch name {
		case "extract":
			copyFile(filepath.Join(repo, "contracts", "mock", "startup.infra.json"), out)
		case "investigate":
			os.WriteFile(out, []byte(`{"findings": []}`), 0o644)
		case "propose":
			copyFile(filepath.Join(fixtures, "candidates."+argument(invocation.Command, "--revision")+".json"), out)
		case "engine":
			copyFile(filepath.Join(results, "result."+revisionInName.FindStringSubmatch(out)[1]+".json"), out)
		case "sandbox":
			copyFile(filepath.Join(repo, "contracts", "rehearsal.example.json"), out)
		case "states":
			os.WriteFile(out, []byte(`{"dataset": {"candidate": "`+argument(invocation.Command, "--candidate")+`"}}`), 0o644)
		}
		return workflow.Outcome{}, nil
	}
}

func argument(command []string, flag string) string {
	index := slices.Index(command, flag)
	if index < 0 || index+1 >= len(command) {
		return ""
	}
	return command[index+1]
}

func copyFile(source, destination string) {
	data, err := os.ReadFile(source)
	if err != nil {
		panic(err)
	}
	os.WriteFile(destination, data, 0o644)
}

var repo, fixtures = func() (string, string) {
	_, file, _, _ := runtime.Caller(0)
	root := filepath.Join(filepath.Dir(file), "..", "..", "..", "..")
	return root, filepath.Join(root, "apps", "orchestrator", "testdata", "flow")
}()

type harness struct {
	t       *testing.T
	flow    *workflow.Workflow
	stages  *fakeStages
	runsDir string
	store   workflow.Store
}

type options struct {
	maxRevisions int
	overrides    map[string]stage
	store        func(workflow.Store) workflow.Store
	runsDir      string
	projectsDir  string
	timeout      time.Duration
	noStates     bool
}

func newHarness(t *testing.T, opts options) *harness {
	t.Helper()
	h, err := build(t, opts)
	if err != nil {
		t.Fatal(err)
	}
	return h
}

func build(t *testing.T, opts options) (*harness, error) {
	t.Helper()
	schemas, err := contracts.Load(filepath.Join(repo, "contracts"))
	if err != nil {
		t.Fatal(err)
	}
	if opts.runsDir == "" {
		opts.runsDir = t.TempDir()
	}
	directory, err := store.Open(opts.runsDir)
	if err != nil {
		t.Fatal(err)
	}
	var runs workflow.Store = directory
	if opts.store != nil {
		runs = opts.store(directory)
	}
	timeout := opts.timeout
	if timeout == 0 {
		timeout = time.Minute
	}
	timeouts := map[run.Step]time.Duration{}
	for _, step := range []run.Step{run.Extract, run.Investigate, run.Propose, run.Evaluate, run.Rehearse} {
		timeouts[step] = timeout
	}
	stages := &fakeStages{overrides: opts.overrides}
	if opts.projectsDir == "" {
		opts.projectsDir = filepath.Join(repo, "contracts", "mock")
	}
	config := workflow.Config{
		Commands:     workflow.Commands{Extract: []string{"extract"}, Agent: []string{"agent"}, Engine: []string{"engine"}, Sandbox: []string{"sandbox"}, States: statesCommand(opts)},
		ProjectsDir:  opts.projectsDir,
		CatalogPath:  filepath.Join(repo, "contracts", "real", "catalog.json"),
		MaxRevisions: opts.maxRevisions,
		Timeouts:     timeouts,
	}
	flow := workflow.New(config, stages, schemas, files.Local{}, runs, time.Now)
	if err := flow.Load(); err != nil {
		return nil, err
	}
	t.Cleanup(flow.Shutdown)
	return &harness{t: t, flow: flow, stages: stages, runsDir: opts.runsDir, store: runs}, nil
}

func projectsNamed(t *testing.T, names ...string) string {
	t.Helper()
	dir := t.TempDir()
	for _, name := range names {
		copyFile(filepath.Join(repo, "contracts", "mock", "startup.forecast.json"), filepath.Join(dir, name+".forecast.json"))
	}
	return dir
}

func (h *harness) start() run.Run {
	h.t.Helper()
	started, err := h.flow.Start("startup", nil)
	if err != nil {
		h.t.Fatal(err)
	}
	return started
}

func (h *harness) waitUntil(id string, done func(run.Run) bool) run.Run {
	h.t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		current, err := h.flow.Get(id)
		if err != nil {
			h.t.Fatal(err)
		}
		if done(current) {
			return current
		}
		time.Sleep(10 * time.Millisecond)
	}
	current, _ := h.flow.Get(id)
	h.t.Fatalf("run %s never reached the expected state; last event %+v", id, current.Last())
	return run.Run{}
}

func (h *harness) waitForGate(id string, gate run.Gate) run.Run {
	return h.waitUntil(id, func(r run.Run) bool { return r.Awaiting == gate || r.Status == run.Failed })
}

func (h *harness) waitForEnd(id string) run.Run {
	return h.waitUntil(id, func(r run.Run) bool { return r.Status == run.Failed || r.Status == run.Completed })
}

func human(step run.Step, decision run.Decision) run.Event {
	return run.Event{Step: step, Status: run.Approved, Actor: run.Actor{Kind: "human", ID: "cto", Surface: "dashboard"}, Decision: &decision}
}

func (h *harness) pick(id, layout string) error {
	_, err := h.flow.Decide(id, human(run.Present, run.Decision{Kind: run.PickLayout, Reason: "test", Layout: layout}))
	return err
}

func (h *harness) approve(id string) error {
	_, err := h.flow.Decide(id, human(run.Rehearse, run.Decision{Kind: run.ApprovePlan, Reason: "test"}))
	return err
}

func exitWith(code int, stderr string) stage {
	return func(context.Context, workflow.Invocation) (workflow.Outcome, error) {
		return workflow.Outcome{ExitCode: code, StderrTail: stderr}, nil
	}
}

func failingSaves(after int) func(workflow.Store) workflow.Store {
	return func(inner workflow.Store) workflow.Store {
		return &flakyStore{Store: inner, failAfter: after}
	}
}

type flakyStore struct {
	workflow.Store
	mu        sync.Mutex
	saves     int
	failAfter int
}

func (s *flakyStore) Save(doc *run.Run) error {
	s.mu.Lock()
	s.saves++
	failing := s.saves > s.failAfter
	s.mu.Unlock()
	if failing {
		return errors.New("disk full")
	}
	return s.Store.Save(doc)
}


func statesCommand(opts options) []string {
	if opts.noStates {
		return nil
	}
	return []string{"states"}
}
