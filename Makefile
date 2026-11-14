# Infrared: the whole demo with one command, `make demo`.
# Needs Docker, Go, Node and Python 3.12+; `.env` at the repo root (copy .env.example).

SHELL := /bin/bash
ROOT := $(abspath .)
VENV := $(ROOT)/.venv
PY := $(VENV)/bin/python
PYTHON ?= $(firstword $(shell command -v python3.14 python3.13 python3.12 python3 2>/dev/null))
WITH_ENV := $(ROOT)/scripts/with-env.sh
STACK_PATH := PATH=$(VENV)/bin:$$PATH PYTHONPATH=apps/agent:apps/engine:apps

.PHONY: demo setup env venv node floci estate orchestrator dashboard bot stop test help

help:
	@echo "make demo          everything: setup, Floci, orchestrator :8080, dashboard :5173, Slack bot"
	@echo "make estate        (re)build the demo company in Floci (wipes Floci, ~5 min)"
	@echo "make stop          stop the orchestrator, dashboard and bot"
	@echo "make test          orchestrator, agent, extractor and dashboard tests"

## One command for the demo. Ctrl-C stops everything it started.
demo: setup floci .bin/orchestrator
	@echo "Dashboard: http://127.0.0.1:5173/app/   Orchestrator: http://127.0.0.1:8080"
	@trap 'kill 0' INT TERM EXIT; \
	  $(MAKE) --no-print-directory orchestrator & \
	  $(MAKE) --no-print-directory dashboard & \
	  $(MAKE) --no-print-directory bot & \
	  wait

setup: env venv node

env:
	@test -f .env || { cp .env.example .env; echo "Created .env from .env.example: fill in ANTHROPIC_API_KEY and the SLACK_* tokens."; }

venv: $(PY)
$(PY): apps/agent/requirements.txt
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/pip install -q -r apps/agent/requirements.txt
	@touch $(PY)

node: apps/dashboard/node_modules apps/slack-bot/node_modules
apps/%/node_modules: apps/%/package-lock.json
	cd apps/$* && npm ci --silent
	@touch $@

## The AWS emulator; it starts a Docker container per EC2/RDS/ECS resource, hence the socket.
floci:
	@docker inspect -f '{{.State.Running}}' floci 2>/dev/null | grep -q true || \
	  { docker rm -f floci >/dev/null 2>&1 || true; \
	    docker run -d --name floci -p 4566:4566 -v /var/run/docker.sock:/var/run/docker.sock floci/floci:latest >/dev/null; \
	    echo "Floci started on :4566 (run 'make estate' once to build the demo company)"; }

estate: venv floci
	cd apps/estate && ./run.sh

.bin/orchestrator: $(shell find apps/orchestrator -name '*.go')
	go -C apps/orchestrator build -o ../../.bin/orchestrator ./cmd/orchestrator

orchestrator: .bin/orchestrator
	$(WITH_ENV) env $(STACK_PATH) .bin/orchestrator

dashboard: apps/dashboard/node_modules
	cd apps/dashboard && $(WITH_ENV) npx vite --port 5173 --strictPort --host 127.0.0.1

bot: apps/slack-bot/node_modules
	cd apps/slack-bot && $(WITH_ENV) env PYTHON=$(PY) npm start

stop:
	-@kill $$(lsof -tnP -iTCP:8080 -sTCP:LISTEN) 2>/dev/null
	-@kill $$(lsof -tnP -iTCP@127.0.0.1:5173 -sTCP:LISTEN) 2>/dev/null
	-@pkill -f "ts-node/esm src/entry/main.ts" 2>/dev/null
	@echo "stopped"

test: venv node
	cd apps/orchestrator && PATH=$(VENV)/bin:$$PATH go test ./...
	cd apps/agent && $(PY) -m pytest -q -p no:cacheprovider
	$(PY) -m pytest -q apps/extractor
	cd apps/dashboard && npx tsc --noEmit -p . && npx vitest run
