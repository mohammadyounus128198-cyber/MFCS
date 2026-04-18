#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CONFIG="ci/tlaps-config.json"
SPEC=$(jq -r '.spec' "$CONFIG")

echo "[TLAPS] Spec: $SPEC"
tlapm "$SPEC"
