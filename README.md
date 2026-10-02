# SQLite Wasm

SQLite Wasm conveniently wrapped as an ES Module.

## Installation

```bash
npm install @sqlite.org/sqlite-wasm
```

```bash
yarn add @sqlite.org/sqlite-wasm
```

```bash
pnpm add @sqlite.org/sqlite-wasm
```

```bash
bun add @sqlite.org/sqlite-wasm
```

## Bug reports

> [!Warning]
>
> This project wraps the code of [SQLite Wasm](https://sqlite.org/wasm/doc/trunk/index.md) with _no_
> changes, apart from added TypeScript types. Please do _not_ file issues or feature requests
> regarding the underlying SQLite Wasm code here. Instead, please follow the
> [SQLite bug filing instructions](https://www.sqlite.org/src/wiki?name=Bug+Reports). Filing
> TypeScript type related issues and feature requests is fine.

## Node.js support

> [!Warning]
>
> Node.js is currently only supported for in-memory databases without persistence.

## Usage

See the implementation docs for the package entry point that matches your runtime and storage needs:

- [Main-thread browser usage](docs/main-thread.md)
- [Worker usage with OPFS](docs/worker.md)
- [Node.js usage](docs/node.md)
- [Bundler core omit-api build](docs/bundler-core.md)
- [Bundler vtab omit-api build](docs/bundler-vtab.md)
- [Bundler kvvfs omit-api build](docs/bundler-kvvfs.md)
- [Bundler OPFS omit-api build](docs/bundler-opfs.md)
- [Bundler OPFS WebLocks omit-api build](docs/bundler-opfs-wl.md)
- [Bundler OPFS SAH Pool omit-api build](docs/bundler-sah-pool.md)

Only the worker OPFS implementations allow you to use the origin private file system (OPFS) storage
back-end. The `db` object in these examples implements the
[Object-Oriented API #1](https://sqlite.org/wasm/doc/trunk/api-oo1.md).

## Usage with vite

If you are using [vite](https://vitejs.dev/), you need to add the following config option in
`vite.config.js`:

```js
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
});
```

Check out a [sample project](https://stackblitz.com/edit/vitejs-vite-ttrbwh?file=main.js) that shows
this in action.

## Demo

See the [demo](https://github.com/sqlite/sqlite-wasm/tree/main/demo) folder for examples of how to
use this in the main thread and in a worker. (Note that the worker variant requires special HTTP
headers, so it can't be hosted on GitHub Pages.) An example that shows how to use this with vite is
available on [StackBlitz](https://stackblitz.com/edit/vitejs-vite-ttrbwh?file=main.js).

## Projects using this package

See the list of [npm dependents](https://www.npmjs.com/browse/depended/@sqlite.org/sqlite-wasm) for
this package.

## Building the SQLite Wasm locally

1. Build the Docker image:

   ```bash
   docker build -t sqlite-wasm-builder:env .
   ```

2. Run the build:

   By default, this builds the full upstream npm bundle plus these omit-API variants. All variants
   omit the deprecated Worker1 API:

   - `core`: `omit-api="kvvfs OPFS vtab worker1"`, exported as
     `@sqlite.org/sqlite-wasm/bundler/core`
   - `core-vtab`: `omit-api="kvvfs OPFS worker1"`, exported as
     `@sqlite.org/sqlite-wasm/bundler/vtab`
   - `core-kvvfs`: `omit-api="OPFS vtab worker1"`, exported as
     `@sqlite.org/sqlite-wasm/bundler/kvvfs`
   - `core-opfs`: `omit-api="kvvfs opfs-wl opfs-sahpool vtab worker1"`, exported as
     `@sqlite.org/sqlite-wasm/bundler/opfs`
   - `core-opfs-wl`: `omit-api="kvvfs opfs opfs-sahpool vtab worker1"`, exported as
     `@sqlite.org/sqlite-wasm/bundler/opfs-wl`
   - `core-opfs-sahpool`: `omit-api="kvvfs opfs opfs-wl vtab worker1"`, exported as
     `@sqlite.org/sqlite-wasm/bundler/sah-pool`

   To customize the generated variants, set `SQLITE_WASM_OMIT_API_BUILDS` to a semicolon-separated
   list of `name=api api` entries. Set it to an empty string to build only the full bundle. Custom
   variants are written to `src/bin`; add them to `tsdown.config.ts` and `package.json` if they
   should be published as package subpaths.

   Only bundler-friendly JavaScript artifacts are kept for generated variants. They are written to
   `src/bin` with their variant name in the filename, for example
   `sqlite3-core-bundler-friendly.mjs`, and load the default `sqlite3.wasm` from the full npm bundle
   build. The package build emits optimized copies into `dist` and exports the fixed variants under
   the `/bundler` package subpaths shown above. If the selected SQLite ref does not support
   `omit-api`, set `SQLITE_WASM_OMIT_API_BUILDS` to an empty string to build only the full bundle.

   **Unix (Linux/macOS):**

   ```bash
   docker run --rm \
     -e SQLITE_REF="master" \
     -v "$(pwd)/out":/out \
     -v "$(pwd)/src/bin":/src/bin \
     sqlite-wasm-builder:env build
   ```

   **Windows (PowerShell):**

   ```powershell
   docker run --rm `
     -e SQLITE_REF="master" `
     -v "${PWD}/out:/out" `
     -v "${PWD}/src/bin:/src/bin" `
     sqlite-wasm-builder:env build
   ```

   **Windows (Command Prompt):**

   ```cmd
   docker run --rm ^
     -e SQLITE_REF="master" ^
     -v "%cd%/out:/out" ^
     -v "%cd%/src/bin:/src/bin" ^
     sqlite-wasm-builder:env build
   ```

## Running tests

The test suite consists of Node.js tests and browser-based tests (using Vitest Browser Mode). Tests
aim to sanity-check the exported scripts. We test for correct exports and **very** basic
functionality.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Install Playwright browsers (required for browser tests):

   ```bash
   npx playwright install chromium --with-deps --no-shell
   ```

3. Run all tests:

   ```bash
   npm test
   ```

## Deprecations

The Worker1 and Promiser1 APIs are, as of 2026-04-15, deprecated. They _will not be removed_, but
they also will not be extended further. It is their author's considered opinion that they are too
fragile, too imperformant, and too limited for any non-toy software, and their use is _actively
discouraged_. The "correct" way to use this library is documented in [Usage](#usage) section above.

## License

Apache 2.0.

## Acknowledgements

This project is based on [SQLite Wasm](https://sqlite.org/wasm), which it conveniently wraps as an
ES Module and publishes to npm as
[`@sqlite.org/sqlite-wasm`](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm).
