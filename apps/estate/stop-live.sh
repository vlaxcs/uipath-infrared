#!/usr/bin/env bash
cd "$(dirname "$0")"
[ -f logs/live.pid ] && kill "$(cat logs/live.pid)" 2>/dev/null; rm -f logs/live.pid; true
