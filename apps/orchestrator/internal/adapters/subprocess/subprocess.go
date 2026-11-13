package subprocess

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"infrared/orchestrator/internal/workflow"
)

const (
	tailBytes     = 4096
	maxReasonRune = 300
)

type Runner struct{}

func (Runner) Run(ctx context.Context, invocation workflow.Invocation) (workflow.Outcome, error) {
	if len(invocation.Command) == 0 {
		return workflow.Outcome{}, errors.New("no command configured")
	}
	if err := os.MkdirAll(filepath.Dir(invocation.LogPath), 0o755); err != nil {
		return workflow.Outcome{}, err
	}
	log, err := os.Create(invocation.LogPath)
	if err != nil {
		return workflow.Outcome{}, err
	}
	defer log.Close()

	ctx, cancel := context.WithTimeout(ctx, invocation.Timeout)
	defer cancel()
	stderr := &tail{limit: tailBytes}
	cmd := exec.CommandContext(ctx, invocation.Command[0], invocation.Command[1:]...)
	cmd.Stdout = log
	cmd.Stderr = io.MultiWriter(log, stderr)
	runErr := cmd.Run()

	outcome := workflow.Outcome{StderrTail: lastLine(stderr.bytes()), TimedOut: errors.Is(ctx.Err(), context.DeadlineExceeded)}
	var exit *exec.ExitError
	switch {
	case runErr == nil:
	case errors.As(runErr, &exit):
		outcome.ExitCode = exit.ExitCode()
	case outcome.TimedOut || ctx.Err() != nil:
		outcome.ExitCode = -1
	default:
		return outcome, runErr
	}
	return outcome, nil
}

type tail struct {
	limit int
	data  []byte
}

func (t *tail) Write(p []byte) (int, error) {
	t.data = append(t.data, p...)
	if excess := len(t.data) - t.limit; excess > 0 {
		t.data = t.data[excess:]
	}
	return len(p), nil
}

func (t *tail) bytes() []byte {
	return t.data
}

func lastLine(output []byte) string {
	lines := bytes.Split(bytes.TrimSpace(output), []byte("\n"))
	line := strings.TrimSpace(string(lines[len(lines)-1]))
	if runes := []rune(line); len(runes) > maxReasonRune {
		return string(runes[:maxReasonRune])
	}
	return line
}
