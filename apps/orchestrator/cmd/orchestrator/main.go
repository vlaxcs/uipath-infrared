package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"infrared/orchestrator/internal/app"
	"infrared/orchestrator/internal/settings"
)

func main() {
	if err := serve(); err != nil {
		fmt.Fprintln(os.Stderr, "orchestrator:", err)
		os.Exit(1)
	}
}

func serve() error {
	config, err := settings.Load()
	if err != nil {
		return err
	}
	orchestrator, err := app.Build(config)
	if err != nil {
		return err
	}
	server := &http.Server{Addr: config.Addr, Handler: orchestrator.Handler, ReadHeaderTimeout: 10 * time.Second}

	signals, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	served := make(chan error, 1)
	go func() { served <- server.ListenAndServe() }()
	fmt.Println("orchestrator listening on", config.Addr)

	select {
	case err := <-served:
		orchestrator.Workflow.Shutdown()
		return err
	case <-signals.Done():
	}
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	err = server.Shutdown(shutdown)
	orchestrator.Workflow.Shutdown()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}
