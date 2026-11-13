package workflow

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"infrared/orchestrator/internal/run"
)

var (
	ErrNotFound          = errors.New("not found")
	ErrUnknownProject    = errors.New("unknown project")
	ErrProjectBusy       = errors.New("project busy")
	ErrLayoutNotFeasible = errors.New("layout not feasible")
)

var projectName = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)

type Workflow struct {
	config    Config
	stages    Stages
	contracts Contracts
	files     Files
	store     Store
	now       func() time.Time

	mu         sync.Mutex
	runs       map[string]*tracked
	newest     []*tracked
	lastNumber map[string]int
	active     map[string]string

	rehearsal chan struct{}
	ctx       context.Context
	stop      context.CancelFunc
	inFlight  sync.WaitGroup
}

type tracked struct {
	mu  sync.Mutex
	doc *run.Run
	dir string
}

func New(config Config, stages Stages, contracts Contracts, files Files, store Store, now func() time.Time) *Workflow {
	ctx, stop := context.WithCancel(context.Background())
	return &Workflow{
		config: config, stages: stages, contracts: contracts, files: files, store: store, now: now,
		runs: map[string]*tracked{}, lastNumber: map[string]int{}, active: map[string]string{},
		rehearsal: make(chan struct{}, 1), ctx: ctx, stop: stop,
	}
}

func (w *Workflow) Load() error {
	docs, err := w.store.LoadAll()
	if err != nil {
		return err
	}
	sort.Slice(docs, func(i, j int) bool { return docs[i].StartedAt < docs[j].StartedAt })
	for _, doc := range docs {
		entry := w.register(doc, w.store.DirOf(doc.ID))
		if doc.Status == run.Running {
			w.fail(entry, doc.Step, fmt.Sprintf("the orchestrator restarted during %s", doc.Step), nil)
		}
	}
	return nil
}

func (w *Workflow) Shutdown() {
	w.stop()
	w.inFlight.Wait()
}

func (w *Workflow) Start(project string) (run.Run, error) {
	if !projectName.MatchString(project) {
		return run.Run{}, fmt.Errorf("%w: %q", ErrUnknownProject, project)
	}
	forecast := filepath.Join(w.config.ProjectsDir, project+".forecast.json")
	if _, err := os.Stat(forecast); err != nil {
		return run.Run{}, fmt.Errorf("%w: no %s", ErrUnknownProject, filepath.Base(forecast))
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	if id, busy := w.active[project]; busy {
		return run.Run{}, fmt.Errorf("%w: %s is %s", ErrProjectBusy, project, id)
	}
	id := fmt.Sprintf("run-%s-%04d", project, w.lastNumber[project]+1)
	dir, err := w.store.Create(id)
	if err != nil {
		return run.Run{}, err
	}
	inputs, err := w.copyInputs(forecast, dir)
	if err != nil {
		return run.Run{}, err
	}
	doc := run.New(id, project, w.config.MaxRevisions, inputs, w.now())
	if err := w.store.Save(doc); err != nil {
		return run.Run{}, err
	}
	entry := w.registerLocked(doc, dir)
	w.launch(func() { w.fromExtract(entry) })
	return snapshot(doc), nil
}

func (w *Workflow) Get(id string) (run.Run, error) {
	entry, err := w.lookup(id)
	if err != nil {
		return run.Run{}, err
	}
	entry.mu.Lock()
	defer entry.mu.Unlock()
	return snapshot(entry.doc), nil
}

func (w *Workflow) EventsAfter(id string, seq int) ([]run.Event, error) {
	entry, err := w.lookup(id)
	if err != nil {
		return nil, err
	}
	entry.mu.Lock()
	defer entry.mu.Unlock()
	return entry.doc.EventsAfter(seq), nil
}

func (w *Workflow) List(project string, limit int) []run.Summary {
	w.mu.Lock()
	entries := make([]*tracked, 0, limit)
	for i := len(w.newest) - 1; i >= 0 && len(entries) < limit; i-- {
		if project == "" || w.newest[i].doc.Project == project {
			entries = append(entries, w.newest[i])
		}
	}
	w.mu.Unlock()
	summaries := make([]run.Summary, 0, len(entries))
	for _, entry := range entries {
		entry.mu.Lock()
		summaries = append(summaries, entry.doc.Summary)
		entry.mu.Unlock()
	}
	return summaries
}

func (w *Workflow) Decide(id string, event run.Event) (run.Event, error) {
	if err := run.CheckHumanDecision(event); err != nil {
		return run.Event{}, err
	}
	entry, err := w.lookup(id)
	if err != nil {
		return run.Event{}, err
	}
	entry.mu.Lock()
	defer entry.mu.Unlock()
	if err := entry.doc.CheckGateOpenFor(event.Decision.Kind); err != nil {
		return run.Event{}, err
	}
	if event.Decision.Kind == run.PickLayout {
		if err := w.checkLayout(entry, event.Decision.Layout); err != nil {
			return run.Event{}, err
		}
	}
	appended, err := w.commit(entry, event)
	if err != nil {
		return run.Event{}, err
	}
	switch event.Decision.Kind {
	case run.PickLayout:
		if _, err := w.commit(entry, run.Event{Step: run.Present, Status: run.StepCompleted, Actor: run.OrchestratorActor}); err != nil {
			return appended, nil
		}
		w.launch(func() { w.fromRehearse(entry) })
	case run.ApprovePlan:
		w.release(entry.doc)
	}
	return appended, nil
}

func (w *Workflow) checkLayout(entry *tracked, layout string) error {
	resultFile := latestOutput(entry.doc, "result")
	result, err := w.files.ReadResult(filepath.Join(entry.dir, resultFile))
	if err != nil {
		return err
	}
	if !result.FeasibleCandidate(layout) {
		return fmt.Errorf("%w: %s is not a feasible candidate in %s", ErrLayoutNotFeasible, layout, resultFile)
	}
	return nil
}

func (w *Workflow) copyInputs(forecast, dir string) (run.Inputs, error) {
	forecastFile, err := w.copyInput(forecast, dir, "forecast.json")
	if err != nil {
		return run.Inputs{}, err
	}
	catalogFile, err := w.copyInput(w.config.CatalogPath, dir, "catalog.json")
	if err != nil {
		return run.Inputs{}, err
	}
	return run.Inputs{Forecast: forecastFile, Catalog: catalogFile}, nil
}

func (w *Workflow) copyInput(source, dir, name string) (run.File, error) {
	if err := w.files.Copy(source, filepath.Join(dir, name)); err != nil {
		return run.File{}, err
	}
	return w.fileRef(dir, name)
}

func (w *Workflow) fileRef(dir, name string) (run.File, error) {
	sum, err := w.files.Hash(filepath.Join(dir, name))
	if err != nil {
		return run.File{}, err
	}
	return run.File{Path: name, Sha256: sum}, nil
}

func (w *Workflow) lookup(id string) (*tracked, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	entry, found := w.runs[id]
	if !found {
		return nil, fmt.Errorf("%w: run %s", ErrNotFound, id)
	}
	return entry, nil
}

func (w *Workflow) register(doc *run.Run, dir string) *tracked {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.registerLocked(doc, dir)
}

func (w *Workflow) registerLocked(doc *run.Run, dir string) *tracked {
	entry := &tracked{doc: doc, dir: dir}
	w.runs[doc.ID] = entry
	w.newest = append(w.newest, entry)
	if number := runNumber(doc.ID, doc.Project); number > w.lastNumber[doc.Project] {
		w.lastNumber[doc.Project] = number
	}
	if doc.Active() {
		w.active[doc.Project] = doc.ID
	}
	return entry
}

func (w *Workflow) release(doc *run.Run) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.active[doc.Project] == doc.ID {
		delete(w.active, doc.Project)
	}
}

func (w *Workflow) launch(task func()) {
	w.inFlight.Go(task)
}

func runNumber(id, project string) int {
	number, err := strconv.Atoi(strings.TrimPrefix(id, "run-"+project+"-"))
	if err != nil {
		return 0
	}
	return number
}

func snapshot(doc *run.Run) run.Run {
	copied := *doc
	copied.Events = append([]run.Event(nil), doc.Events...)
	return copied
}

func latestOutput(doc *run.Run, contract string) string {
	for i := len(doc.Events) - 1; i >= 0; i-- {
		if output := doc.Events[i].Output; output != nil && output.Contract == contract {
			return output.File.Path
		}
	}
	return ""
}
