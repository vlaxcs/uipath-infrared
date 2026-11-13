#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
export PYTHONPATH="${PWD}/apps:${PYTHONPATH:-}"

if [ -f .venv/bin/python ]; then
    PYTHON=.venv/bin/python
else
    PYTHON=python3
fi

exec "$PYTHON" -u -m sandbox "$@"
