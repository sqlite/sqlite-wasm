# Bundler OPFS SAH Pool omit-api build

Use this in a Worker when you want the OPFS SyncAccessHandle Pool VFS.

```ts
// Worker
import sqlite3InitModule from '@sqlite.org/sqlite-wasm/bundler/sah-pool';

const sqlite3 = await sqlite3InitModule();
const sahPool = await sqlite3.installOpfsSAHPoolVfs({});
const db = new sahPool.OpfsSAHPoolDb('/app.sqlite3');

try {
  db.exec('CREATE TABLE IF NOT EXISTS events(name TEXT)');
  db.exec({ sql: 'INSERT INTO events(name) VALUES (?)', bind: ['opened'] });
  postMessage({ count: db.selectValue('SELECT count(*) FROM events') });
} finally {
  db.close();
}
```

This build includes the core runtime and OPFS SAH Pool. It omits Worker1, vtab helpers, kvvfs, OPFS,
and OPFS WebLocks.
