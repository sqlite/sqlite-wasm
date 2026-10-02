# Bundler kvvfs omit-api build

Use this when you want the key-value VFS backed by Web Storage.

```ts
// Main thread or worker
import sqlite3InitModule from '@sqlite.org/sqlite-wasm/bundler/kvvfs';

const sqlite3 = await sqlite3InitModule();
const dbName = 'file:my-kvvfs-db?vfs=kvvfs';
const db = new sqlite3.oo1.DB(dbName, 'c');

try {
  db.exec('CREATE TABLE IF NOT EXISTS notes(body TEXT)');
  db.exec({ sql: 'INSERT INTO notes(body) VALUES (?)', bind: ['hello from kvvfs'] });
  console.log(db.selectValue('SELECT body FROM notes ORDER BY rowid DESC LIMIT 1'));
} finally {
  db.close();
}
```

This build includes the core runtime and kvvfs. It omits Worker1, vtab helpers, OPFS, OPFS WebLocks,
and OPFS SAH Pool.
