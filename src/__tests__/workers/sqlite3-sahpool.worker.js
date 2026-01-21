import sqlite3InitModule from '../../bin/sqlite3-bundler-friendly.mjs';

self.onmessage = async () => {
  try {
    const sqlite3 = await sqlite3InitModule();
    const opfsSahPool = await sqlite3.installOpfsSAHPoolVfs();
    let db = new opfsSahPool.OpfsSAHPoolDb('/test-sahpool-worker.sqlite3');

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

      db.close();

      // Reopen to check persistence
      db = new opfsSahPool.OpfsSAHPoolDb('/test-sahpool-worker.sqlite3');
      const count = db.selectValue('SELECT count(*) FROM test');
      if (count !== 2) {
        throw new Error('Persistence check failed');
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
      if (joinedRows.length !== 2) {
        throw new Error('Join check failed');
      }

      // 3. CTE
      const cteCount = db.selectValue(
        'WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt LIMIT 5) SELECT count(*) FROM cnt',
      );
      if (cteCount !== 5) {
        throw new Error('CTE check failed');
      }

      // 4. FTS5
      db.exec('CREATE VIRTUAL TABLE docs USING fts5(content)');
      db.exec("INSERT INTO docs (content) VALUES ('sqlite is great')");
      const ftsResult = db.selectValue(
        "SELECT content FROM docs WHERE docs MATCH 'sqlite'",
      );
      if (ftsResult !== 'sqlite is great') {
        throw new Error('FTS5 check failed');
      }

      // 5. Math Functions
      const cosResult = db.selectValue('SELECT cos(0)');
      if (cosResult !== 1) {
        throw new Error('Math functions check failed');
      }

      // 6. Percentile
      db.exec('CREATE TABLE p(x); INSERT INTO p VALUES (1),(2),(3),(4),(5);');
      const perc = db.selectValue('SELECT percentile(x, 50) FROM p');
      if (perc !== 3) {
        throw new Error('Percentile check failed');
      }

      // 7. pauseVfs and unpauseVfs
      // Ensure it's not paused initially
      if (opfsSahPool.isPaused()) {
        throw new Error('VFS should not be paused initially');
      }

      db.close(); // Must close DB before pausing if it's the only one using it,
      // or at least ensures no open file handles.
      // Actually, pauseVfs throws if there are open file handles.

      opfsSahPool.pauseVfs();
      if (!opfsSahPool.isPaused()) {
        throw new Error('VFS should be paused after pauseVfs()');
      }

      // Attempting to open a DB with a paused VFS should fail
      try {
        new opfsSahPool.OpfsSAHPoolDb('/test-sahpool-worker.sqlite3');
        throw new Error('Opening DB should have failed while VFS is paused');
      } catch (e) {
        // Expected error
      }

      await opfsSahPool.unpauseVfs();
      if (opfsSahPool.isPaused()) {
        throw new Error('VFS should not be paused after unpauseVfs()');
      }

      // Test that pauseVfs() throws if there are open file handles
      db = new opfsSahPool.OpfsSAHPoolDb('/test-sahpool-worker.sqlite3');
      try {
        opfsSahPool.pauseVfs();
        throw new Error('pauseVfs should have failed with open DB handles');
      } catch (e) {
        if (!e.message.includes('Cannot pause VFS')) {
          throw new Error(
            'pauseVfs failed with unexpected error: ' + e.message,
          );
        }
      }
      db.close();

      // Now it should work again
      db = new opfsSahPool.OpfsSAHPoolDb('/test-sahpool-worker.sqlite3');
      const count2 = db.selectValue('SELECT count(*) FROM test');
      if (count2 !== 2) {
        throw new Error('Persistence check after unpause failed');
      }

      self.postMessage({ type: 'success' });
    } finally {
      db.close();
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message, stack: err.stack });
  }
};
