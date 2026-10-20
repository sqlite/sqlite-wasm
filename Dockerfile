# syntax=docker/dockerfile:1
ARG EMSDK_VERSION=5.0.5
FROM emscripten/emsdk:${EMSDK_VERSION} AS wasm-tools

# The SDK already supplies the build dependencies. SQLite's release build
# only needs wasm-strip from WABT; install the package in a helper stage.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
 && apt-get update \
 && apt-get install -y --no-install-recommends wabt

FROM emscripten/emsdk:${EMSDK_VERSION}

# Using the same SDK base in both stages preserves binary compatibility.
COPY --from=wasm-tools /usr/bin/wasm-strip /usr/local/bin/wasm-strip
COPY --from=wasm-tools /usr/share/doc/wabt/copyright /usr/share/doc/wabt/copyright

COPY --chmod=755 scripts/build-sqlite3-wasm.sh /usr/local/bin/build-sqlite3-wasm.sh

ENTRYPOINT ["/usr/local/bin/build-sqlite3-wasm.sh"]
CMD ["build"]
