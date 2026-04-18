#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CONFIG="ci/tlc-config.json"
SPEC=$(jq -r '.spec' "$CONFIG")
CFG=$(jq -r '.config' "$CONFIG")
WORKERS=$(jq -r '.workers' "$CONFIG")
DEPTH=$(jq -r '.depth' "$CONFIG")

echo "[TLC] Spec: $SPEC"
echo "[TLC] Config: $CFG"
echo "[TLC] Workers: $WORKERS"
echo "[TLC] Depth: $DEPTH"

java -cp tla2tools.jar tlc2.TLC -workers "$WORKERS" ${DEPTH:+-depth "$DEPTH"} -config "$CFG" "$SPEC"
