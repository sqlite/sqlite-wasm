import sqlite3InitModule from '../../../../src/index.js';

self.onmessage = async (e) => {
  if (e.data.type === 'start') {
    try {
      const sqlite3 = await sqlite3InitModule();
      const opfsSahPool = await sqlite3.installOpfsSAHPoolVfs({
        directory: '/sqlite-wasm-sahpool-demo',
      });

      const db = new opfsSahPool.OpfsSAHPoolDb('/test-sahpool-worker.sqlite3');

      // 1. Basic CRUD
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      db.exec({
        sql: 'INSERT INTO test (name) VALUES (?), (?)',
        bind: ['Alice', 'Bob'],
      });

      const rows = db.selectObjects('SELECT * FROM test ORDER BY id');

      db.close();

      self.postMessage({ type: 'success', rows });
    } catch (err: any) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }
};
