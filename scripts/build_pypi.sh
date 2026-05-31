#!/usr/bin/env bash
#
# Regenerate the bundled JS + WASM that the PyPI (pip) distribution ships, then
# build the Python wheel/sdist.
#
# The pip package (name: gorchestrator) does not reimplement the tool. It bundles
# the Node CLI into a single CommonJS file and launches it via the user's Node.js
# (>= 18). better-sqlite3 is kept external (native; not bundled) and degrades to a
# volatile in-memory store at runtime. tiktoken's WASM is shipped as a sidecar.
#
# Usage:  bash scripts/build_pypi.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BUNDLE_DIR="python/gorchestrator/_bundle"

echo "==> Installing npm deps (ignore-scripts: skip native builds)"
npm install --ignore-scripts

echo "==> Building TypeScript (tsc -> dist/)"
npm run build

echo "==> Bundling CLI with esbuild -> ${BUNDLE_DIR}/gorchestrator.cli.js"
mkdir -p "${BUNDLE_DIR}"
npx esbuild dist/cli.js \
  --bundle \
  --platform=node \
  --target=node18 \
  --format=cjs \
  --outfile="${BUNDLE_DIR}/gorchestrator.cli.js" \
  --external:better-sqlite3

echo "==> Copying tiktoken WASM sidecar next to the bundle"
cp node_modules/tiktoken/tiktoken_bg.wasm "${BUNDLE_DIR}/tiktoken_bg.wasm"

echo "==> Smoke-testing the bundle with Node"
node "${BUNDLE_DIR}/gorchestrator.cli.js" --version
node "${BUNDLE_DIR}/gorchestrator.cli.js" --help >/dev/null

echo "==> Building Python wheel + sdist (python -m build)"
python -m build

echo "==> twine check"
python -m twine check dist/*

echo "==> Done. Artifacts in dist/"
