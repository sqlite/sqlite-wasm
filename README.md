# SQLite Wasm

SQLite Wasm conveniently wrapped as an ES Module.

## Installation

```bash
npm install @sqlite.org/sqlite-wasm
```

## Usage

There are two ways to use SQLite Wasm:
[in the main thread](#in-the-main-thread-without-opfs) and
[in a worker](#in-a-worker-with-opfs-if-available). Only the worker version
allows you to use the origin private file system (OPFS) storage back-end.

### In the main thread (without OPFS):

```js
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const log = (...args) => console.log(...args);
const error = (...args) => console.error(...args);

const start = function (sqlite3) {
  log('Running SQLite3 version', sqlite3.version.libVersion);
  const db = new sqlite3.oo1.DB('/mydb.sqlite3', 'ct');
  // Your SQLite code here.
};

log('Loading and initializing SQLite3 module...');
sqlite3InitModule({
  print: log,
  printErr: error,
}).then((sqlite3) => {
  try {
    log('Done initializing. Running demo...');
    start(sqlite3);
  } catch (err) {
    error(err.name, err.message);
  }
});
```

### In a worker (with OPFS if available):

> **Warning** For this to work, you need to set the following headers on your
> server:
>
> `Cross-Origin-Opener-Policy: same-origin`
>
> `Cross-Origin-Embedder-Policy: require-corp`

```js
// In `main.js`.
const worker = new Worker('worker.js', { type: 'module' });
```

```js
// In `worker.js`.
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const log = (...args) => console.log(...args);
const error = (...args) => console.error(...args);

const start = function (sqlite3) {
  log('Running SQLite3 version', sqlite3.version.libVersion);
  let db;
  if ('opfs' in sqlite3) {
    db = new sqlite3.oo1.OpfsDb('/mydb.sqlite3');
    log('OPFS is available, created persisted database at', db.filename);
  } else {
    db = new sqlite3.oo1.DB('/mydb.sqlite3', 'ct');
    log('OPFS is not available, created transient database', db.filename);
  }
  // Your SQLite code here.
};

log('Loading and initializing SQLite3 module...');
sqlite3InitModule({
  print: log,
  printErr: error,
}).then((sqlite3) => {
  log('Done initializing. Running demo...');
  try {
    start(sqlite3);
  } catch (err) {
    error(err.name, err.message);
  }
});
```

## Usage with vite

If you are using [vite](https://vitejs.dev/), you need to add the following
config option:

```js
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
});
```

Check out a
[sample project](https://stackblitz.com/edit/vitejs-vite-3rk63d?file=main.js)
that shows this in action.

## Deploying a new version

(These steps can only be executed by maintainers.)

1. Update the version number in `package.json` reflecting the current
   [SQLite version number](https://sqlite.org/download.html) and add a build
   identifier suffix like `-build1`. The complete version number should read
   something like `3.41.2-build1`.
1. Run `npm run build` to build the ES Module. This downloads the latest SQLite
   Wasm binary and builds the ES Module.
1. Run `git commit -am "Release v<version>"` to commit the changes.
1. Run `git push` to push the changes to GitHub.
1. Run `npm publish --access-public` to publish the new version to npm.

## License

Apache 2.0.

## Acknowledgements

This project is based on [SQLite Wasm](https://sqlite.org/wasm), which it
conveniently wraps as an ES Module and publishes to npm as
[`@sqlite.org/sqlite-wasm`](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm).
