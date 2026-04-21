import sqlite3InitModule from '../../../../src/index.js';

self.onmessage = async (e) => {
  if (e.data.type === 'start') {
    try {
      const sqlite3 = await sqlite3InitModule();
      const filename = '/opfs-wl-demo.sqlite3';
      const db = new sqlite3.oo1.OpfsWlDb(filename, 'ct');

      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      db.exec({
        sql: 'INSERT INTO test (name) VALUES (?), (?)',
        bind: ['OPFS-WL 1', 'OPFS-WL 2'],
      });

      const rows = db.selectObjects('SELECT * FROM test ORDER BY id');

      db.close();

      self.postMessage({ type: 'success', filename, rows });
    } catch (err: any) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }
};
