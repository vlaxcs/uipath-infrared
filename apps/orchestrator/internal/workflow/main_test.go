package workflow_test

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

var results string

func TestMain(m *testing.M) {
	dir, err := os.MkdirTemp("", "workflow-results-")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	results = dir
	if err := evaluateWithTheRealEngine(dir); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.RemoveAll(dir)
		os.Exit(1)
	}
	code := m.Run()
	os.RemoveAll(dir)
	os.Exit(code)
}

func evaluateWithTheRealEngine(dir string) error {
	python := os.Getenv("FLOW_PYTHON")
	if python == "" {
		python = "python"
	}
	contracts := filepath.Join(repo, "contracts")
	for _, revision := range []string{"0", "1"} {
		engine := exec.Command(python, "-m", "engine", "evaluate",
			filepath.Join(contracts, "mock", "startup.infra.json"),
			filepath.Join(contracts, "mock", "startup.forecast.json"),
			filepath.Join(contracts, "real", "catalog.json"),
			"--candidates", filepath.Join(fixtures, "candidates."+revision+".json"),
			"--out", filepath.Join(dir, "result."+revision+".json"))
		engine.Env = append(os.Environ(), "PYTHONPATH="+filepath.Join(repo, "apps", "engine"))
		if output, err := engine.CombinedOutput(); err != nil {
			return fmt.Errorf("the engine could not evaluate candidates.%s.json: %v\n%s", revision, err, output)
		}
	}
	return nil
}
