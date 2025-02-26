# SQLite Wasm

SQLite Wasm conveniently wrapped as an ES Module.

## Bug reports

> [!Warning]
>
> This project wraps the code of
> [SQLite Wasm](https://sqlite.org/wasm/doc/trunk/index.md) with _no_ changes,
> apart from added TypeScript types. Please do _not_ file issues or feature
> requests regarding the underlying SQLite Wasm code here. Instead, please
> follow the
> [SQLite bug filing instructions](https://www.sqlite.org/src/wiki?name=Bug+Reports).
> Filing TypeScript type related issues and feature requests is fine.

## Node.js support

> [!Warning]
>
> Node.js is currently only supported for in-memory databases without
> persistence.

## Installation

```bash
npm install @sqlite.org/sqlite-wasm
```

## Usage

There are three ways to use SQLite Wasm:

- [in the main thread with a wrapped worker](#in-a-wrapped-worker-with-opfs-if-available)
  (🏆 preferred option)
- [in a worker](#in-a-worker-with-opfs-if-available)
- [in the main thread](#in-the-main-thread-without-opfs)

Only the worker versions allow you to use the origin private file system (OPFS)
storage back-end.

### In a wrapped worker (with OPFS if available):

> [!Warning]
>
> For this to work, you need to set the following headers on your server:
>
> `Cross-Origin-Opener-Policy: same-origin`
>
> `Cross-Origin-Embedder-Policy: require-corp`

```js
import { sqlite3Worker1Promiser } from '@sqlite.org/sqlite-wasm';

const log = console.log;
const error = console.error;

const initializeSQLite = async () => {
  try {
    log('Loading and initializing SQLite3 module...');

    const promiser = await new Promise((resolve) => {
      const _promiser = sqlite3Worker1Promiser({
        onready: () => resolve(_promiser),
      });
    });

    log('Done initializing. Running demo...');

    const configResponse = await promiser('config-get', {});
    log('Running SQLite3 version', configResponse.result.version.libVersion);

    const openResponse = await promiser('open', {
      filename: 'file:mydb.sqlite3?vfs=opfs',
    });
    const { dbId } = openResponse;
    log(
      'OPFS is available, created persisted database at',
      openResponse.result.filename.replace(/^file:(.*?)\?vfs=opfs$/, '$1'),
    );
    // Your SQLite code here.
  } catch (err) {
    if (!(err instanceof Error)) {
      err = new Error(err.result.message);
    }
    error(err.name, err.message);
  }
};

initializeSQLite();
```

The `promiser` object above implements the
[Worker1 API](https://sqlite.org/wasm/doc/trunk/api-worker1.md#worker1-methods).

### In a worker (with OPFS if available):

> [!Warning]
>
> For this to work, you need to set the following headers on your server:
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

const log = console.log;
const error = console.error;

const start = (sqlite3) => {
  log('Running SQLite3 version', sqlite3.version.libVersion);
  const db =
    'opfs' in sqlite3
      ? new sqlite3.oo1.OpfsDb('/mydb.sqlite3')
      : new sqlite3.oo1.DB('/mydb.sqlite3', 'ct');
  log(
    'opfs' in sqlite3
      ? `OPFS is available, created persisted database at ${db.filename}`
      : `OPFS is not available, created transient database ${db.filename}`,
  );
  // Your SQLite code here.
};

const initializeSQLite = async () => {
  try {
    log('Loading and initializing SQLite3 module...');
    const sqlite3 = await sqlite3InitModule({ print: log, printErr: error });
    log('Done initializing. Running demo...');
    start(sqlite3);
  } catch (err) {
    error('Initialization error:', err.name, err.message);
  }
};

initializeSQLite();
```

The `db` object above implements the
[Object Oriented API #1](https://sqlite.org/wasm/doc/trunk/api-oo1.md).

### In the main thread (without OPFS):

```js
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const log = console.log;
const error = console.error;

const start = (sqlite3) => {
  log('Running SQLite3 version', sqlite3.version.libVersion);
  const db = new sqlite3.oo1.DB('/mydb.sqlite3', 'ct');
  // Your SQLite code here.
};

const initializeSQLite = async () => {
  try {
    log('Loading and initializing SQLite3 module...');
    const sqlite3 = await sqlite3InitModule({
      print: log,
      printErr: error,
    });
    log('Done initializing. Running demo...');
    start(sqlite3);
  } catch (err) {
    error('Initialization error:', err.name, err.message);
  }
};

initializeSQLite();
```

The `db` object above implements the
[Object Oriented API #1](https://sqlite.org/wasm/doc/trunk/api-oo1.md).

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

See the [demo](https://github.com/sqlite/sqlite-wasm/tree/main/demo) folder for
examples of how to use this in the main thread and in a worker. (Note that the
worker variant requires special HTTP headers, so it can't be hosted on GitHub
Pages.) An example that shows how to use this with vite is available on
[StackBlitz](https://stackblitz.com/edit/vitejs-vite-ttrbwh?file=main.js).

## Projects using this package

See the list of
[npm dependents](https://www.npmjs.com/browse/depended/@sqlite.org/sqlite-wasm)
for this package.

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
