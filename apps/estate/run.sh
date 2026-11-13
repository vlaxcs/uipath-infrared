#!/usr/bin/env bash
# Rebuild the whole estate: wipe floci, create resources, backfill 14d of metrics, start the live pusher.
set -e
cd "$(dirname "$0")"
[ -d .venv ] || { python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt; }
./stop-live.sh
./reset.sh
.venv/bin/python -m synth.main
.venv/bin/python -m synth.metrics backfill
.venv/bin/python -m synth.graph
mkdir -p logs
nohup .venv/bin/python -m synth.metrics live > logs/live.log 2>&1 &
echo $! > logs/live.pid
echo "live metrics pusher running (pid $(cat logs/live.pid)); stop with ./stop-live.sh"
