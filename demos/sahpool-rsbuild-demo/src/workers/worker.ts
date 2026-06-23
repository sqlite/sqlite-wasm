import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

self.onmessage = async (e) => {
  if (e.data.type !== 'start') return;

  try {
    const sqlite3 = await sqlite3InitModule();
    const opfsSahPool = await sqlite3.installOpfsSAHPoolVfs({
      directory: '/sqlite-wasm-sahpool-rsbuild-demo',
      clearOnInit: true,
    });

    const db = new opfsSahPool.OpfsSAHPoolDb('/test-sahpool-rsbuild-worker.sqlite3');
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    db.exec({
      sql: 'INSERT INTO test (name) VALUES (?), (?)',
      bind: ['Alice', 'Bob'],
    });

    const rows = db.selectObjects('SELECT * FROM test ORDER BY id');
    db.close();
    self.postMessage({ type: 'success', rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', message });
  }
};
