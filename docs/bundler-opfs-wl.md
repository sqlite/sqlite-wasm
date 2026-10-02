# Bundler OPFS WebLocks omit-api build

Use this in a Worker when you want the WebLocks-backed OPFS VFS.

```ts
// Worker
import sqlite3InitModule from '@sqlite.org/sqlite-wasm/bundler/opfs-wl';

const sqlite3 = await sqlite3InitModule();
const db = new sqlite3.oo1.OpfsWlDb('/app.sqlite3', 'ct');

try {
  db.exec('CREATE TABLE IF NOT EXISTS events(name TEXT)');
  db.exec({ sql: 'INSERT INTO events(name) VALUES (?)', bind: ['opened'] });
  postMessage({ count: db.selectValue('SELECT count(*) FROM events') });
} finally {
  db.close();
}
```

This build includes the core runtime and OPFS WebLocks. It omits Worker1, vtab helpers, kvvfs, OPFS,
and OPFS SAH Pool.
