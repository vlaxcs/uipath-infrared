package subprocess_test

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"infrared/orchestrator/internal/adapters/subprocess"
	"infrared/orchestrator/internal/workflow"
)

func python(t *testing.T) string {
	t.Helper()
	for _, name := range []string{"python", "python3"} {
		if path, err := exec.LookPath(name); err == nil {
			return path
		}
	}
	t.Skip("no python on PATH")
	return ""
}

func invoke(t *testing.T, script string, timeout time.Duration) (workflow.Outcome, string, error) {
	t.Helper()
	dir := t.TempDir()
	log := filepath.Join(dir, "logs", "1-extract.log")
	outcome, err := subprocess.Runner{}.Run(context.Background(), workflow.Invocation{
		Command: []string{python(t), "-c", script},
		LogPath: log,
		Timeout: timeout,
	})
	written, _ := os.ReadFile(log)
	return outcome, string(written), err
}

func TestTheExitCodeAndTheLastStderrLineComeBack(t *testing.T) {
	outcome, log, err := invoke(t, `import sys; print("out"); print("first", file=sys.stderr); print("last\n", file=sys.stderr); sys.exit(3)`, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if outcome.ExitCode != 3 || outcome.StderrTail != "last" || outcome.TimedOut {
		t.Fatalf("outcome %+v", outcome)
	}
	if !strings.Contains(log, "out") || !strings.Contains(log, "first") {
		t.Fatalf("the log misses the stage's output: %q", log)
	}
}

func TestTheReasonIsCutTo300Characters(t *testing.T) {
	outcome, _, _ := invoke(t, `import sys; print("x" * 1000, file=sys.stderr); sys.exit(1)`, time.Minute)
	if len(outcome.StderrTail) != 300 {
		t.Fatalf("reason is %d characters", len(outcome.StderrTail))
	}
}

func TestAStageThatRunsTooLongTimesOut(t *testing.T) {
	outcome, _, err := invoke(t, `import time; time.sleep(30)`, 300*time.Millisecond)
	if err != nil || !outcome.TimedOut {
		t.Fatalf("outcome %+v, err %v; want a timeout", outcome, err)
	}
}

func TestAMissingCommandIsAnError(t *testing.T) {
	_, err := subprocess.Runner{}.Run(context.Background(), workflow.Invocation{
		Command: []string{"no-such-stage-command"},
		LogPath: filepath.Join(t.TempDir(), "x.log"),
		Timeout: time.Second,
	})
	if err == nil {
		t.Fatal("a command that does not exist ran")
	}
}
