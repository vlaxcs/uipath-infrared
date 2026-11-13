#!/usr/bin/env bash
# `floci aws reset` times out once EC2/ECS/EKS containers exist, so wipe them and restart instead.
set -e
docker ps -a --format '{{.Names}}' | grep '^floci-aws-' | xargs -r docker rm -f >/dev/null 2>&1 || true
floci aws restart >/dev/null
floci aws wait
