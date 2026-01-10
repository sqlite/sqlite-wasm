# syntax=docker/dockerfile:1
FROM emscripten/emsdk:latest

ARG DEBIAN_FRONTEND=noninteractive

# runtime / build deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    build-essential \
    autoconf \
    automake \
    libtool \
    m4 \
    python3 \
    nodejs \
    npm \
    zip \
    unzip \
    curl \
 && rm -rf /var/lib/apt/lists/*

# create useful dirs
RUN mkdir -p /build /out /src/bin /work

# copy helper script
COPY scripts/build-sqlite3-wasm.sh /usr/local/bin/build-sqlite3-wasm.sh
RUN chmod +x /usr/local/bin/build-sqlite3-wasm.sh

WORKDIR /work

ENTRYPOINT ["/usr/local/bin/build-sqlite3-wasm.sh"]
CMD ["build"]
