#!/usr/bin/env bash
set -euo pipefail

SQLITE_REPO="${SQLITE_REPO:-https://github.com/sqlite/sqlite.git}"
SQLITE_REF="${SQLITE_REF:-master}"
SRC_DIR="${WORKDIR:-/build/sqlite-src}"
HOST_UID="${HOST_UID:-}"
HOST_GID="${HOST_GID:-}"
WASM_OPT_WRAPPER=""
EXTRACT_DIR=""

log() { printf '\033[1;34m[build]\033[0m %s\n' "$*"; }

if [ "${1:-}" = "shell" ]; then
  exec /bin/bash
fi
if [ "${1:-}" != "build" ]; then
  echo "Usage: <image> build (or 'shell' for debugging)"
  exit 2
fi

mkdir -p /src/bin
cleanup() {
  local status=$?
  trap - EXIT
  if [ -n "$WASM_OPT_WRAPPER" ]; then rm -f "$WASM_OPT_WRAPPER"; fi
  if [ -n "$EXTRACT_DIR" ]; then rm -rf "$EXTRACT_DIR"; fi
  if [ -n "$HOST_UID" ] && [ -n "$HOST_GID" ]; then
    log "Fixing ownership for /src/bin to $HOST_UID:$HOST_GID"
    chown -R "$HOST_UID:$HOST_GID" /src/bin || status=1
  fi
  exit "$status"
}
trap cleanup EXIT

if ! mountpoint -q /src/bin; then
  log "WARNING: /src/bin is not a volume mount. Output will be lost when the container exits."
fi
log "Building $SQLITE_REPO at $SQLITE_REF"

# Fail on fetch errors rather than falling back to a stale checkout.
mkdir -p "$SRC_DIR"
if [ ! -d "$SRC_DIR/.git" ]; then
  git -C "$SRC_DIR" init
fi
if git -C "$SRC_DIR" remote get-url origin >/dev/null 2>&1; then
  git -C "$SRC_DIR" remote set-url origin "$SQLITE_REPO"
else
  git -C "$SRC_DIR" remote add origin "$SQLITE_REPO"
fi
git -C "$SRC_DIR" fetch --depth 1 origin "$SQLITE_REF"
git -C "$SRC_DIR" checkout --detach FETCH_HEAD

# shellcheck disable=SC1091
source /emsdk/emsdk_env.sh
cd "$SRC_DIR"
log "Running ./configure"
./configure
log "make sqlite3.c"
make sqlite3.c
cd ext/wasm

# SQLite invokes wasm-opt with --all-features. Newer Binaryen versions then
# emit compact imports, which are not supported by our browser/Node targets.
# Append the compatibility flag after SQLite's flags, preserving its passes.
WASM_OPT_WRAPPER="$(mktemp /tmp/sqlite-wasm-opt.XXXXXX)"
printf '#!/usr/bin/env bash\nexec %q "$@" --disable-compact-imports\n' \
  "$(command -v wasm-opt)" > "$WASM_OPT_WRAPPER"
chmod +x "$WASM_OPT_WRAPPER"

# Check the generated defaults before overriding the per-loader flags. Refuse
# to silently discard additional flags introduced by an upstream SQLite update.
make .wasmbuilds.make WASM_CUSTOM_INSTANTIATE=0
python3 - <<'PY'
from pathlib import Path
import re

defaults = Path('.wasmbuilds.make').read_text()
for build in ('bundler', 'esm'):
    assignments = re.findall(r'^emcc\.flags\.' + build + r'\s*[:+?]?=([^\n]*)', defaults, re.M)
    if any(value.split('#', 1)[0].strip() for value in assignments):
        raise SystemExit(f'Upstream emcc.flags.{build} is no longer empty; merge its flags before enabling COS')
PY

log "Running make -j4 npm with Cross-Origin Storage for browser loaders (excluding Node)"
# SQLite's custom instantiateWasm bypasses Emscripten's COS loading path.
make -j4 npm WASM_CUSTOM_INSTANTIATE=0 \
  'emcc.flags.bundler=-sCROSS_ORIGIN_STORAGE' \
  'emcc.flags.esm=-sCROSS_ORIGIN_STORAGE' \
  "bin.wasm-opt=$WASM_OPT_WRAPPER"

# Extract to staging and verify before replacing the mounted output.
log "Extracting npm-bundle.zip"
EXTRACT_DIR="$(mktemp -d /tmp/sqlite-wasm-bundle.XXXXXX)"
unzip -q npm-bundle.zip -d "$EXTRACT_DIR"
cd "$EXTRACT_DIR/jswasm"

log "Updating and verifying the COS hash after Wasm post-processing"
python3 - <<'PY'
import hashlib
from pathlib import Path
import re

wasm = Path('sqlite3.wasm')
loaders = [Path('sqlite3-bundler-friendly.mjs'), Path('sqlite3.mjs')]
digest = hashlib.sha256(wasm.read_bytes()).hexdigest()
pattern = re.compile(
    r"(Module\['wasmHash'\]\s*=\s*\{\s*algorithm:\s*'SHA-256',\s*value:\s*')"
    r"[0-9a-f]{64}('\s*\})"
)
for loader in loaders:
    source, count = pattern.subn(lambda match: match[1] + digest + match[2], loader.read_text())
    if count != 1:
        raise SystemExit(f'Expected exactly one COS hash in {loader}, found {count}')
    if "Module['instantiateWasm'] =" in source:
        raise SystemExit(f'Custom instantiator would bypass COS in {loader}')
    loader.write_text(source)
node_source = Path('sqlite3-node.mjs').read_text()
if 'crossOriginStorage' in node_source or 'wasmHash' in node_source:
    raise SystemExit('Node loader must not include COS')

# Verify the files we will actually publish, after SQLite's Wasm post-processing.
for loader in loaders:
    match = pattern.search(loader.read_text())
    if not match or digest not in match[0]:
        raise SystemExit(f'Final COS hash verification failed in {loader}')
print(f'COS SHA-256: {digest}')
PY

log "Publishing verified artifacts to /src/bin"
find /src/bin -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
cp -a "$EXTRACT_DIR/jswasm/." /src/bin/
log "Build complete. Extracted contents are in /src/bin"
ls -la /src/bin
