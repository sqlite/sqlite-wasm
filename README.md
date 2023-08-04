# SQLite Wasm

SQLite Wasm conveniently wrapped as an ES Module.

> **Note**
>
> This project wraps the code of
> [SQLite Wasm](https://sqlite.org/wasm/doc/trunk/index.md) with _no_ changes.
> Please do _not_ file issues or feature requests regarding the underlying
> SQLite Wasm code here. Instead, please follow the
> [SQLite bug filing instructions](https://www.sqlite.org/src/wiki?name=Bug+Reports).

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

## Usage with the bundled `SQLiteClient` (with OPFS if available):

> **Warning** For this to work, you need to set the following headers on your
> server:
>
> `Cross-Origin-Opener-Policy: same-origin`
>
> `Cross-Origin-Embedder-Policy: require-corp`

Import the `@sqlite.org/sqlite-wasm` library in your code and use it as such:

```js
import { SqliteClient } from '@sqlite.org/sqlite-wasm';

// Must correspond to the path in your final deployed build.
const sqliteWorkerPath = 'assets/js/sqlite-worker.js';
// This is the name of your database. It corresponds to the path in the OPFS.
const filename = '/test.sqlite3';

const sqlite = new Sqlite(filename, sqliteWorkerPath);
await sqlite.init();

await sqlite.executeSql('CREATE TABLE IF NOT EXISTS test(a,b)');
await sqlite.executeSql('INSERT INTO test VALUES(?, ?)', [6, 7]);
const results = await sqlite.executeSql('SELECT * FROM test');
```

## Usage with vite

If you are using [vite](https://vitejs.dev/), you need to add the following
config option in `vite.config.js`:

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

Check out a
[sample project](https://stackblitz.com/edit/vitejs-vite-ttrbwh?file=main.js)
that shows this in action.

## Demo

See the [demo](https://github.com/tomayac/sqlite-wasm/tree/main/demo) folder for
examples of how to use this in the main thread and in a worker. (Note that the
worker variant requires special HTTP headers, so it can't be hosted on GitHub
Pages.) An example that shows how to use this with vite is available on
[StackBlitz](https://stackblitz.com/edit/vitejs-vite-ttrbwh?file=main.js).

## Deploying a new version

(These steps can only be executed by maintainers.)

1. Update the version number in `package.json` reflecting the current
   [SQLite version number](https://sqlite.org/download.html) and add a build
   identifier suffix like `-build1`. The complete version number should read
   something like `3.41.2-build1`.
1. Run `npm run build` to build the ES Module. This downloads the latest SQLite
   Wasm binary and builds the ES Module.
1. Run `npm run deploy` to commit the changes, push to GitHub, and publish the
   new version to npm.

## License

Apache 2.0.

## Acknowledgements

This project is based on [SQLite Wasm](https://sqlite.org/wasm), which it
conveniently wraps as an ES Module and publishes to npm as
[`@sqlite.org/sqlite-wasm`](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm).
