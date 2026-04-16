import sqlite3InitModule from '../../../../src/index.js';

self.onmessage = async (e) => {
  if (e.data.type === 'start') {
    try {
      const sqlite3 = await sqlite3InitModule();
      const db = new sqlite3.oo1.DB(':memory:');

      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      db.exec({
        sql: 'INSERT INTO test (name) VALUES (?), (?)',
        bind: ['InWorker 1', 'InWorker 2'],
      });

      const rows = db.selectObjects('SELECT * FROM test');

      db.close();

      self.postMessage({ type: 'success', rows });
    } catch (err: any) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }
};
