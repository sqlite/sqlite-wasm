# Bundler OPFS omit-api build

Use this in a dedicated Worker when you want the synchronous OPFS VFS.

```ts
// Worker
import sqlite3InitModule from '@sqlite.org/sqlite-wasm/bundler/opfs';

const sqlite3 = await sqlite3InitModule();
const db = new sqlite3.oo1.OpfsDb('/app.sqlite3', 'ct');

try {
  db.exec('CREATE TABLE IF NOT EXISTS events(name TEXT)');
  db.exec({ sql: 'INSERT INTO events(name) VALUES (?)', bind: ['opened'] });
  postMessage({ count: db.selectValue('SELECT count(*) FROM events') });
} finally {
  db.close();
}
```

Serve Worker pages with cross-origin isolation headers when the browser requires them. This build
includes the core runtime and OPFS. It omits Worker1, vtab helpers, kvvfs, OPFS WebLocks, and OPFS
SAH Pool.
