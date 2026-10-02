# Node example

Use the default package entry in Node.js.

```ts
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const sqlite3 = await sqlite3InitModule();
const db = new sqlite3.oo1.DB(':memory:');

try {
  db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT)');
  db.exec({ sql: 'INSERT INTO users(name) VALUES (?), (?)', bind: ['Ada', 'Linus'] });
  console.log(db.selectObjects('SELECT * FROM users ORDER BY id'));
} finally {
  db.close();
}
```

The OPFS VFSes are browser APIs, so Node examples should use `:memory:`.
