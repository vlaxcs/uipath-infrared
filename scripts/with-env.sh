#!/usr/bin/env bash
# Runs a command with the repo-root .env loaded. Values may contain spaces
# (e.g. ORCHESTRATOR_ENGINE_CMD=python -m engine), so `set -a; . .env` won't do.
# Variables already set in the environment win over the file.
set -euo pipefail
env_file="$(cd "$(dirname "$0")/.." && pwd)/.env"
if [ -f "$env_file" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in '' | \#*) continue ;; esac
    key="${line%%=*}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    [ -n "${!key+x}" ] || export "$key=${line#*=}"
  done < "$env_file"
fi
exec "$@"
