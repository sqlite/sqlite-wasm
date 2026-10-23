#!/usr/bin/env bash
set -euo pipefail

SQLITE_REPO="${SQLITE_REPO:-https://github.com/sqlite/sqlite.git}"
SQLITE_REF="${SQLITE_REF:-master}"
OUT_DIR="${OUT_DIR:-/out}"
SRC_DIR="${WORKDIR:-/build/sqlite-src}"
HOST_UID="${HOST_UID:-}"
HOST_GID="${HOST_GID:-}"

# Ensure out exists and is writable
mkdir -p "$OUT_DIR"
mkdir -p /src/bin

# Check if volumes are mounted
check_mounts() {
  if ! mountpoint -q "$OUT_DIR" 2>/dev/null; then
    # Fallback check using device IDs if mountpoint command is not available or fails
    root_dev=$(stat -c %d /)
    out_dev=$(stat -c %d "$OUT_DIR")
    if [ "$root_dev" = "$out_dev" ]; then
      log "WARNING: $OUT_DIR does not appear to be a volume mount. Files will be lost when the container exits."
    fi
  fi
  if ! mountpoint -q /src/bin 2>/dev/null; then
    root_dev=$(stat -c %d /)
    bin_dev=$(stat -c %d /src/bin)
    if [ "$root_dev" = "$bin_dev" ]; then
      log "WARNING: /src/bin does not appear to be a volume mount. Files will be lost when the container exits."
    fi
  fi
}

# Helper: log
log() { printf '\033[1;34m[build]\033[0m %s\n' "$*"; }

# Handle ownership fixup on exit
cleanup() {
  if [ -n "$HOST_UID" ] && [ -n "$HOST_GID" ]; then
    log "Fixing ownership for /out and /src/bin to $HOST_UID:$HOST_GID"
    chown -R "$HOST_UID:$HOST_GID" "$OUT_DIR" /src/bin
  fi
}
trap cleanup EXIT

if [ "${1:-}" = "shell" ]; then
  exec /bin/bash
fi

if [ "${1:-}" != "build" ]; then
  echo "Usage: <image> build  (or 'shell' for debugging)"
  exit 2
fi

log "Starting sqlite build"
check_mounts
log "Repo: $SQLITE_REPO"
log "Ref:  $SQLITE_REF"
log "Out: $OUT_DIR"
log "Src dir: $SRC_DIR"

# prepare source dir: clone shallow or fetch+reset if exists
if [ -d "$SRC_DIR/.git" ]; then
  log "Repository already exists, fetching updates..."
  git -C "$SRC_DIR" fetch --depth 1 origin "$SQLITE_REF" || git -C "$SRC_DIR" fetch --unshallow || true
  git -C "$SRC_DIR" checkout --detach FETCH_HEAD || git -C "$SRC_DIR" checkout "$SQLITE_REF" || git -C "$SRC_DIR" reset --hard origin/"$SQLITE_REF"
else
  log "Cloning repository..."
  rm -rf "$SRC_DIR"
  mkdir -p "$SRC_DIR"
  git -C "$SRC_DIR" init
  git -C "$SRC_DIR" remote add origin "$SQLITE_REPO"
  log "Fetching ref: $SQLITE_REF"
  if git -C "$SRC_DIR" fetch --depth 1 origin "$SQLITE_REF"; then
    git -C "$SRC_DIR" checkout --detach FETCH_HEAD
  else
    log "Failed to fetch shallow ref, trying full clone..."
    rm -rf "$SRC_DIR"
    git clone "$SQLITE_REPO" "$SRC_DIR"
    git -C "$SRC_DIR" checkout "$SQLITE_REF"
  fi
fi

# Ensure emsdk environment active in this shell
if [ -f /emsdk/emsdk_env.sh ]; then
  # shellcheck disable=SC1091
  source /emsdk/emsdk_env.sh
else
  log "Warning: /emsdk/emsdk_env.sh not found — emscripten environment not available"
fi

# build steps
cd "$SRC_DIR"

# regenerate configure if not present
if [ ! -f ./configure ]; then
  log "Running autoreconf -f -i"
  autoreconf -f -i
fi

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

log "Running make -j4 npm with Cross-Origin Storage for the bundler-friendly browser loader"
make -j4 npm 'emcc.flags.bundler=-sCROSS_ORIGIN_STORAGE' "bin.wasm-opt=$WASM_OPT_WRAPPER"

# SQLite strips the Wasm after emcc embeds its hash. Update only the COS
# loader's hash to describe the final, shared binary before packaging it.
log "Updating and verifying the COS hash after Wasm post-processing"
python3 - <<'PY'
import hashlib
from pathlib import Path
import re
import zipfile

wasm = Path('jswasm/sqlite3.wasm')
loader = Path('jswasm/sqlite3-bundler-friendly.mjs')
digest = hashlib.sha256(wasm.read_bytes()).hexdigest()
pattern = re.compile(
    r"(Module\['wasmHash'\]\s*=\s*\{\s*algorithm:\s*'SHA-256',\s*value:\s*')"
    r"[0-9a-f]{64}('\s*\})"
)
source, count = pattern.subn(lambda match: match[1] + digest + match[2], loader.read_text())
if count != 1:
    raise SystemExit(f'Expected exactly one COS hash in {loader}, found {count}')
loader.write_text(source)

# The npm target has already created the archive. Replace its loader so the
# extracted artifacts and archived binary have the same verified hash.
with zipfile.ZipFile('npm-bundle.zip') as archive:
    entries = [(info, archive.read(info)) for info in archive.infolist()]
with zipfile.ZipFile('npm-bundle.zip', 'w') as archive:
    for info, data in entries:
        if info.filename == loader.as_posix():
            data = loader.read_bytes()
        archive.writestr(info, data)
with zipfile.ZipFile('npm-bundle.zip') as archive:
    packaged_loader = archive.read(loader.as_posix()).decode()
    packaged_digest = hashlib.sha256(archive.read(wasm.as_posix())).hexdigest()
    if packaged_digest != digest or not pattern.search(packaged_loader):
        raise SystemExit('Packaged COS loader or Wasm hash verification failed')
    if pattern.search(packaged_loader)[0] != pattern.search(source)[0]:
        raise SystemExit('Packaged COS hash differs from the final Wasm hash')
print(f'COS SHA-256: {digest}')
PY

# ensure artifact exists
if [ ! -f npm-bundle.zip ]; then
  log "ERROR: npm-bundle.zip not found in ext/wasm"
  exit 3
fi

# copy zip into OUT_DIR
log "Copying npm-bundle.zip to $OUT_DIR"
cp -f npm-bundle.zip "$OUT_DIR/npm-bundle.zip"
chmod a+r "$OUT_DIR/npm-bundle.zip"

# extract into /src/bin (normalize single top-level dir)
log "Extracting npm-bundle.zip into /src/bin"
# Clear existing contents to ensure a clean overwrite
rm -rf /src/bin/*
mkdir -p /src/bin
unzip -q -o "$OUT_DIR/npm-bundle.zip" -d /src/bin
rm -f "$OUT_DIR/npm-bundle.zip"

# If a single top-level directory exists, move its contents up
shopt -s nullglob
entries=(/src/bin/*)
if [ "${#entries[@]}" -eq 1 ] && [ -d "${entries[0]}" ]; then
  log "Zip contained top-level dir: moving contents up"
  mv "${entries[0]}"/* /src/bin/ || true
  rmdir "${entries[0]}" || true
fi
shopt -u nullglob

log "Build complete. Extracted contents are in /src/bin"
exec /bin/ls -la /src/bin
