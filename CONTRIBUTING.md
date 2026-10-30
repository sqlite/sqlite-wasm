# Contributing

## Local development

Use Node.js 22 or later. From the repository root, install dependencies and build the package:

```bash
npm install
npm run build
```

The package build uses the SQLite Wasm binaries already included in `src/bin` and writes the package
files to `dist`.

Start an example with its `dev:*` script, for example:

```bash
npm run dev:main-thread
```

For the OPFS example, use `npm run dev:opfs`. Other examples have corresponding `dev:*` scripts in
`package.json`. Rebuild the package after changing its source files.

## Building the SQLite Wasm locally

To rebuild the underlying SQLite Wasm binaries, use Docker:

1. Build the Docker image:

   ```bash
   docker build -t sqlite-wasm-builder:env .
   ```

2. Run the build:

   **Unix (Linux/macOS):**

   ```bash
   docker run --rm \
     -e SQLITE_REF="master" \
     -v "$(pwd)/src/bin":/src/bin \
     sqlite-wasm-builder:env build
   ```

   **Windows (PowerShell):**

   ```powershell
   docker run --rm `
     -e SQLITE_REF="master" `
     -v "${PWD}/src/bin:/src/bin" `
     sqlite-wasm-builder:env build
   ```

   **Windows (Command Prompt):**

   ```cmd
   docker run --rm ^
     -e SQLITE_REF="master" ^
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

## Deploying a new version

(These steps can only be executed by maintainers.)

1. Manually trigger the [GitHub Actions workflow](../../actions/workflows/build-wasm.yml). By
   default, it uses the latest SQLite tag. This pull request will contain the latest `sqlite3.wasm`
   and related bindings.

2. Once the above pull request is validated and merged, update the version number in `package.json`,
   reflecting the current [SQLite version number](https://sqlite.org/download.html) and add a build
   identifier suffix like `-build1`. The complete version number should read something like
   `3.41.2-build1`.
