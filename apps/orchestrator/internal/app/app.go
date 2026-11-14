package app

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"infrared/orchestrator/internal/adapters/contracts"
	"infrared/orchestrator/internal/adapters/files"
	"infrared/orchestrator/internal/adapters/github"
	"infrared/orchestrator/internal/adapters/httpapi"
	"infrared/orchestrator/internal/adapters/postgres"
	"infrared/orchestrator/internal/adapters/store"
	"infrared/orchestrator/internal/adapters/subprocess"
	"infrared/orchestrator/internal/auth"
	"infrared/orchestrator/internal/profile"
	"infrared/orchestrator/internal/settings"
	"infrared/orchestrator/internal/workflow"
)

const sweepEvery = time.Hour

type App struct {
	Handler  http.Handler
	Workflow *workflow.Workflow
	close    func()
}

func (a App) Close() {
	if a.close != nil {
		a.close()
	}
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
	platform := struct {
		*workflow.Workflow
		*profile.Store
	}{flow, profile.Open(config.RunsDir)}

	if !config.Auth.Enabled {
		return App{Handler: httpapi.Handler(platform, config.AllowedOrigins...), Workflow: flow}, nil
	}

	users, err := postgres.Open(context.Background(), config.Auth.DatabaseURL)
	if err != nil {
		return App{}, err
	}
	oauth := github.NewOAuth(github.OAuthConfig{ClientID: config.Auth.ClientID, ClientSecret: config.Auth.ClientSecret})
	service := auth.NewService(users, oauth, config.Auth.ServiceToken, time.Now)
	handler := httpapi.AuthenticatedHandler(platform, service, httpapi.AuthOptions{
		DashboardURL:   config.Auth.DashboardURL,
		AllowedOrigins: config.AllowedOrigins,
	})
	stopSweep := sweepExpired(service)
	return App{Handler: handler, Workflow: flow, close: func() {
		stopSweep()
		users.Close()
	}}, nil
}

func sweepExpired(service *auth.Service) func() {
	ctx, cancel := context.WithCancel(context.Background())
	var done sync.WaitGroup
	done.Add(1)
	go func() {
		defer done.Done()
		ticker := time.NewTicker(sweepEvery)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if _, err := service.DeleteExpired(ctx); err != nil && ctx.Err() == nil {
					fmt.Fprintln(os.Stderr, "orchestrator: sweeping expired sessions:", err)
				}
			}
		}
	}()
	return func() {
		cancel()
		done.Wait()
	}
}
