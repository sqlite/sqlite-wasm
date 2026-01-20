import sqlite3InitModule from '../../bin/sqlite3-bundler-friendly.mjs';

self.onmessage = async (e) => {
  try {
    const sqlite3 = await sqlite3InitModule();
    const opfsSahPool = await sqlite3.installOpfsSAHPoolVfs();
    const db = new opfsSahPool.OpfsSAHPoolDb('/test-sahpool-worker.sqlite3');

    try {
      // 1. Basic CRUD
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      db.exec({
        sql: 'INSERT INTO test (name) VALUES (?), (?)',
        bind: ['Alice', 'Bob'],
      });

      const rows = [];
      db.exec({
        sql: 'SELECT * FROM test ORDER BY id',
        rowMode: 'object',
        callback: (row) => rows.push(row),
      });

      if (
        rows.length !== 2 ||
        rows[0].name !== 'Alice' ||
        rows[1].name !== 'Bob'
      ) {
        throw new Error('CRUD check failed');
      }

      // 2. Joins
      db.exec(
        'CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, product TEXT)',
      );
      db.exec(
        "INSERT INTO orders (user_id, product) VALUES (2, 'Laptop'), (2, 'Mouse')",
      );
      const joinedRows = [];
      db.exec({
        sql: 'SELECT test.name, orders.product FROM test INNER JOIN orders ON test.id = orders.user_id',
        rowMode: 'object',
        callback: (row) => joinedRows.push(row),
      });
      if (joinedRows.length !== 2) throw new Error('Join check failed');

      // 3. CTE
      const cteCount = db.selectValue(
        'WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt LIMIT 5) SELECT count(*) FROM cnt',
      );
      if (cteCount !== 5) throw new Error('CTE check failed');

      // 4. FTS5
      db.exec('CREATE VIRTUAL TABLE docs USING fts5(content)');
      db.exec("INSERT INTO docs (content) VALUES ('sqlite is great')");
      const ftsResult = db.selectValue(
        "SELECT content FROM docs WHERE docs MATCH 'sqlite'",
      );
      if (ftsResult !== 'sqlite is great') throw new Error('FTS5 check failed');

      // 5. Math Functions
      const cosResult = db.selectValue('SELECT cos(0)');
      if (cosResult !== 1) throw new Error('Math functions check failed');

      // 6. Percentile
      db.exec('CREATE TABLE p(x); INSERT INTO p VALUES (1),(2),(3),(4),(5);');
      const perc = db.selectValue('SELECT percentile(x, 50) FROM p');
      if (perc !== 3) throw new Error('Percentile check failed');

      self.postMessage({ type: 'success' });
    } finally {
      db.close();
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message, stack: err.stack });
  }
};
