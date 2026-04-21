import sqlite3InitModule from '../../../src/index.js';

const runDemo = async () => {
  const sqlite3 = await sqlite3InitModule();
  const dbName = 'kvvfs-demo';

  sqlite3.kvvfs.unlink(dbName);

  const db = new sqlite3.oo1.JsStorageDb('session');
  db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
  db.exec({
    sql: 'INSERT INTO test (name) VALUES (?), (?)',
    bind: ['kvvfs 1', 'kvvfs 2'],
  });

  const rows = db.selectObjects('SELECT * FROM test ORDER BY id');
  const size = db.storageSize();

  const app = document.getElementById('app');
  if (app) {
    const sizeInfo = document.createElement('p');
    sizeInfo.textContent = `Stored in kvvfs as ${dbName} (${size} bytes)`;
    app.appendChild(sizeInfo);

    const ul = document.createElement('ul');
    rows.forEach((row: any) => {
      const li = document.createElement('li');
      li.textContent = `${row.id}: ${row.name}`;
      ul.appendChild(li);
    });
    app.appendChild(ul);
  }

  db.close();
};

runDemo().catch(console.error);
