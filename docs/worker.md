# Worker example

Use an OPFS omit-api build in a module Worker when you want persistent browser storage.

```ts
// Worker
import sqlite3InitModule from '@sqlite.org/sqlite-wasm/bundler/opfs';

self.onmessage = async () => {
  const sqlite3 = await sqlite3InitModule();
  const db = new sqlite3.oo1.OpfsDb('/worker.sqlite3', 'ct');

  try {
    db.exec('CREATE TABLE IF NOT EXISTS messages(body TEXT)');
    db.exec({ sql: 'INSERT INTO messages(body) VALUES (?)', bind: ['hello from a worker'] });
    self.postMessage({ count: db.selectValue('SELECT count(*) FROM messages') });
  } finally {
    db.close();
  }
};
```

```ts
// Main thread
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
worker.onmessage = (event) => console.log(event.data);
worker.postMessage({ type: 'start' });
```

Use `@sqlite.org/sqlite-wasm/bundler/opfs-wl` or `@sqlite.org/sqlite-wasm/bundler/sah-pool` for the
other OPFS VFS implementations.
