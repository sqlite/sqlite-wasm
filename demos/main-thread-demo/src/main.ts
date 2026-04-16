import sqlite3InitModule from '../../../src/index.js';

const runDemo = async () => {
  const sqlite3 = await sqlite3InitModule();

  // 1. Create a database
  const db = new sqlite3.oo1.DB(':memory:');

  // 2. Create a table
  db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');

  // 3. Insert data
  db.exec({
    sql: 'INSERT INTO test (name) VALUES (?), (?)',
    bind: ['Alice', 'Bob'],
  });

  // 4. Query data
  const rows = db.selectObjects('SELECT * FROM test ORDER BY id');

  const app = document.getElementById('app');
  if (app) {
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
