#!/usr/bin/env bash
set -euo pipefail

SQLITE_REPO="${SQLITE_REPO:-https://github.com/sqlite/sqlite.git}"
SQLITE_REF="${SQLITE_REF:-master}"
OUT_DIR="${OUT_DIR:-/out}"
SRC_DIR="${WORKDIR:-/build/sqlite-src}"
HOST_UID="${HOST_UID:-}"
HOST_GID="${HOST_GID:-}"
DEFAULT_OMIT_API_BUILDS="core=kvvfs OPFS vtab worker1;core-vtab=kvvfs OPFS worker1;core-kvvfs=OPFS vtab worker1;core-opfs=kvvfs opfs-wl opfs-sahpool vtab worker1;core-opfs-wl=kvvfs opfs opfs-sahpool vtab worker1;core-opfs-sahpool=kvvfs opfs opfs-wl vtab worker1"

if [ "${SQLITE_WASM_OMIT_API_BUILDS+x}" = "x" ]; then
  OMIT_API_BUILDS="$SQLITE_WASM_OMIT_API_BUILDS"
elif [ "${OMIT_API_BUILDS+x}" != "x" ]; then
  OMIT_API_BUILDS="$DEFAULT_OMIT_API_BUILDS"
fi

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

trim() {
  local value="$*"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

extract_npm_bundle() {
  local zip_file="$1"
  local target_dir="$2"

  mkdir -p "$target_dir"
  find "$target_dir" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  unzip -q -o "$zip_file" -d "$target_dir"

  shopt -s nullglob
  local entries=("$target_dir"/*)
  if [ "${#entries[@]}" -eq 1 ] && [ -d "${entries[0]}" ]; then
    log "Zip contained top-level dir: moving contents up"
    mv "${entries[0]}"/* "$target_dir"/ || true
    rmdir "${entries[0]}" || true
  fi
  shopt -u nullglob
}

copy_if_exists() {
  local source_file="$1"
  local target_file="$2"

  if [ -f "$source_file" ]; then
    cp -f "$source_file" "$target_file"
  fi
}

install_variant_artifacts() {
  local variant="$1"
  local extracted_dir="$2"

  log "Installing bundler-friendly variant artifacts for: $variant"
  copy_if_exists "$extracted_dir/sqlite3-bundler-friendly.mjs" "/src/bin/sqlite3-${variant}-bundler-friendly.mjs"
}

create_variant_zip() {
  local variant="$1"
  local zip_file="$2"
  local staging_dir="/tmp/sqlite-wasm-variant-${variant}"

  rm -rf "$staging_dir"
  mkdir -p "$staging_dir"
  cp -f "/src/bin/sqlite3-${variant}-bundler-friendly.mjs" "$staging_dir/"

  rm -f "$zip_file"
  (cd "$staging_dir" && zip -q -r "$zip_file" .)
  chmod a+r "$zip_file"
}

build_npm_bundle() {
  local label="$1"
  local omit_apis="$2"

  log "Running make clean for $label"
  make clean >/dev/null 2>&1 || true
  rm -f npm-bundle.zip

  if [ -n "$omit_apis" ]; then
    log "Running make -j4 npm omit-api=\"$omit_apis\" (ext/wasm)"
    make -j4 npm omit-api="$omit_apis"
  else
    log "Running make -j4 npm (ext/wasm)"
    make -j4 npm
  fi

  if [ ! -f npm-bundle.zip ]; then
    log "ERROR: npm-bundle.zip not found in ext/wasm"
    exit 3
  fi
}

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
log "Omit API builds: ${OMIT_API_BUILDS:-<none>}"

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

if [ -n "${OMIT_API_BUILDS:-}" ] && ! grep -q 'omit-api' GNUmakefile; then
  log "ERROR: omit API builds were requested, but this SQLite ref does not support omit-api."
  log "Set SQLITE_WASM_OMIT_API_BUILDS= to build only the full bundle, or use a SQLite ref with omit-api support."
  exit 5
fi

build_npm_bundle "full" ""

# copy zip into OUT_DIR and extract the full build into /src/bin
log "Copying npm-bundle.zip to $OUT_DIR"
cp -f npm-bundle.zip "$OUT_DIR/npm-bundle.zip"
chmod a+r "$OUT_DIR/npm-bundle.zip"

# extract into /src/bin (normalize single top-level dir)
log "Extracting npm-bundle.zip into /src/bin"
extract_npm_bundle "$OUT_DIR/npm-bundle.zip" /src/bin

if [ -n "${OMIT_API_BUILDS:-}" ]; then
  IFS=';' read -r -a omit_build_specs <<< "$OMIT_API_BUILDS"
  for spec in "${omit_build_specs[@]}"; do
    spec="$(trim "$spec")"
    if [ -z "$spec" ]; then
      continue
    fi

    if [[ "$spec" != *=* ]]; then
      log "ERROR: invalid omit API build spec '$spec'. Expected name=api api."
      exit 4
    fi

    variant="$(trim "${spec%%=*}")"
    omit_apis="$(trim "${spec#*=}")"
    if [[ ! "$variant" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
      log "ERROR: invalid variant name '$variant'. Use lowercase letters, numbers, and hyphens."
      exit 4
    fi

    build_npm_bundle "$variant" "$omit_apis"

    variant_zip="$OUT_DIR/npm-bundle-${variant}.zip"
    variant_dir="/tmp/sqlite-wasm-npm-${variant}"
    log "Extracting variant bundle for artifact renaming"
    extract_npm_bundle npm-bundle.zip "$variant_dir"
    install_variant_artifacts "$variant" "$variant_dir"
    log "Writing bundler-friendly variant bundle to $variant_zip"
    create_variant_zip "$variant" "$variant_zip"
  done
fi

log "Build complete. Extracted contents are in /src/bin"
exec /bin/ls -la /src/bin
