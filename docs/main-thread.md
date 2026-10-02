# Main-thread browser example

Use this pattern when you do not need OPFS. It matches the main-thread example from the README and
uses a transient database.

```ts
// Main thread
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const sqlite3 = await sqlite3InitModule();
const db = new sqlite3.oo1.DB('/mydb.sqlite3', 'ct');

try {
  db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT)');
  db.exec({ sql: 'INSERT INTO users(name) VALUES (?), (?)', bind: ['Ada', 'Linus'] });
  console.log(db.selectObjects('SELECT * FROM users ORDER BY id'));
} finally {
  db.close();
}
```

For OPFS-backed databases, prefer a Worker and one of the OPFS omit-api builds.
