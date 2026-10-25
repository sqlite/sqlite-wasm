# SQLite Wasm

SQLite Wasm conveniently wrapped as an ES Module.

## Installation

```bash
npm install @sqlite.org/sqlite-wasm
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

There are two ways to use SQLite Wasm:

- [in a worker](#in-a-worker-with-opfs)
- [in the main thread](#in-the-main-thread-without-opfs)

Only the worker versions allow you to use the origin private file system (OPFS) storage back-end.

### In a worker (with OPFS):

> [!Warning]
>
> For this to work, you need to set the following headers on your server:
>
> `Cross-Origin-Opener-Policy: same-origin`
>
> `Cross-Origin-Embedder-Policy: require-corp`

```ts
// In `main.ts`.
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
```

```ts
// In `worker.ts`.
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const sqlite3 = await sqlite3InitModule();

console.log('Running SQLite3 version', sqlite3.version.libVersion);

const db = new sqlite3.oo1.OpfsDb('/mydb.sqlite3');

try {
  // Your SQLite code here.
} finally {
  db.close();
}
```

The `db` object above implements the
[Object-Oriented API #1](https://sqlite.org/wasm/doc/trunk/api-oo1.md).

### In the main thread (without OPFS):

```ts
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const sqlite3 = await sqlite3InitModule();

console.log('Running SQLite3 version', sqlite3.version.libVersion);

const db = new sqlite3.oo1.DB('/mydb.sqlite3', 'ct');

try {
  // Your SQLite code here.
} finally {
  db.close();
}
```

The `db` object above implements the
[Object-Oriented API #1](https://sqlite.org/wasm/doc/trunk/api-oo1.md).

## Usage with Vite

If you are using [Vite](https://vitejs.dev/), you need to add the following config option in
`vite.config.ts`:

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

See our [OPFS](./demos/opfs-demo) and [SAH pool](./demos/sahpool-demo) examples for working Vite
projects.

## Examples

- [Main thread](./demos/main-thread-demo)
- [Worker](./demos/in-worker-demo)
- [OPFS](./demos/opfs-demo)
- [OPFS with Web Locks](./demos/opfs-wl-demo)
- [Key-value storage (kvvfs)](./demos/kvvfs-demo)
- [SAH pool with Vite](./demos/sahpool-demo)
- [SAH pool with webpack](./demos/sahpool-webpack-demo)
- [SAH pool with Parcel](./demos/sahpool-parcel-demo)
- [SAH pool with Rsbuild](./demos/sahpool-rsbuild-demo)

## Projects using this package

See the list of [npm dependents](https://www.npmjs.com/browse/depended/@sqlite.org/sqlite-wasm) for
this package.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for deployment, local build, and testing instructions.

## Deprecations

The Worker1 and Promiser1 APIs are, as of 2026-04-15, deprecated. They _will not be removed_, but
they also will not be extended further. It is their author's considered opinion that they are too
fragile, too imperformant, and too limited for any non-toy software, and their use is _actively
discouraged_. The "correct" way to use this library is documented in [Usage](#usage) section above.

## Acknowledgements

This project is based on [SQLite Wasm](https://sqlite.org/wasm), which it conveniently wraps as an
ES Module and publishes to npm as
[`@sqlite.org/sqlite-wasm`](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm).
