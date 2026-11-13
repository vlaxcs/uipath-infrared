package app

import (
	"net/http"
	"time"

	"infrared/orchestrator/internal/adapters/contracts"
	"infrared/orchestrator/internal/adapters/files"
	"infrared/orchestrator/internal/adapters/httpapi"
	"infrared/orchestrator/internal/adapters/store"
	"infrared/orchestrator/internal/adapters/subprocess"
	"infrared/orchestrator/internal/settings"
	"infrared/orchestrator/internal/workflow"
)

type App struct {
	Handler  http.Handler
	Workflow *workflow.Workflow
}

func Build(config settings.Settings) (App, error) {
	schemas, err := contracts.Load(config.ContractsDir)
	if err != nil {
		return App{}, err
	}
	runs, err := store.Open(config.RunsDir)
	if err != nil {
		return App{}, err
	}
	flow := workflow.New(config.Workflow, subprocess.Runner{}, schemas, files.Local{}, runs, time.Now)
	if err := flow.Load(); err != nil {
		return App{}, err
	}
	return App{Handler: httpapi.Handler(flow, config.AllowedOrigins...), Workflow: flow}, nil
}
