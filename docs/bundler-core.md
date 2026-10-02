# Bundler core omit-api build

Use this when you want the smallest browser bundler entry and only need the core SQLite APIs.

```ts
// Main thread or worker
import sqlite3InitModule from '@sqlite.org/sqlite-wasm/bundler/core';

const sqlite3 = await sqlite3InitModule();
const db = new sqlite3.oo1.DB(':memory:');

try {
  db.exec('CREATE TABLE t(value); INSERT INTO t(value) VALUES (1)');
  console.log(db.selectValue('SELECT value FROM t'));
} finally {
  db.close();
}
```

This build omits Worker1, vtab helpers, kvvfs, OPFS, OPFS WebLocks, and OPFS SAH Pool.
