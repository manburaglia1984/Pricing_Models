#!/bin/sh
# Host the pricing model for the team. Serves the index.html sitting next to this
# script and owns data/pricing-store.json. Leave it running: stopping it takes the
# store offline for everyone.
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "Node.js is not installed, or not on PATH."
  echo "Install the LTS build from https://nodejs.org/ , then run this again."
  echo
  exit 1
fi

exec node sync-server.mjs --host 0.0.0.0 --port 8787 "$@"
