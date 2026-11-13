package workflow

import (
	"fmt"
	"path/filepath"
	"slices"

	"infrared/orchestrator/internal/run"
)

func (w *Workflow) run(entry *tracked, step run.Step, seq int, command []string, accepted ...int) (Outcome, bool) {
	outcome, err := w.stages.Run(w.ctx, Invocation{
		Command: command,
		LogPath: filepath.Join(entry.dir, "logs", fmt.Sprintf("%d-%s.log", seq, step)),
		Timeout: w.config.Timeouts[step],
	})
	switch {
	case w.ctx.Err() != nil:
		return outcome, w.fail(entry, step, fmt.Sprintf("the orchestrator stopped during %s", step), nil)
	case err != nil:
		return outcome, w.fail(entry, step, fmt.Sprintf("%s could not start: %v", step, err), nil)
	case outcome.TimedOut:
		return outcome, w.fail(entry, step, fmt.Sprintf("%s timed out after %s", step, w.config.Timeouts[step]), nil)
	case !slices.Contains(accepted, outcome.ExitCode):
		return outcome, w.fail(entry, step, stageFailure(step, outcome), nil)
	}
	return outcome, true
}

func stageFailure(step run.Step, outcome Outcome) string {
	if outcome.StderrTail == "" {
		return fmt.Sprintf("%s exited %d", step, outcome.ExitCode)
	}
	return fmt.Sprintf("%s exited %d: %s", step, outcome.ExitCode, outcome.StderrTail)
}

func (w *Workflow) extractCommand(entry *tracked, project string) []string {
	return w.command(w.config.Commands.Extract, "--project", project, "--out", w.path(entry, "infra.json"))
}

func (w *Workflow) agentCommand(entry *tracked, arguments ...string) []string {
	return w.command(w.config.Commands.Agent, arguments...)
}

func (w *Workflow) engineCommand(entry *tracked, arguments ...string) []string {
	return w.command(w.config.Commands.Engine, arguments...)
}

func (w *Workflow) sandboxCommand(entry *tracked, arguments ...string) []string {
	return w.command(w.config.Commands.Sandbox, arguments...)
}

func (w *Workflow) command(prefix []string, arguments ...string) []string {
	return append(slices.Clone(prefix), arguments...)
}
