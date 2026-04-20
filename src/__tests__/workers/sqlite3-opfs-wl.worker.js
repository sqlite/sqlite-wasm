import sqlite3InitModule from '../../bin/sqlite3-bundler-friendly.mjs';

const cleanupOpfsFile = async (filename) => {
  const entryName = filename.replace(/^\//, '');

  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(entryName);
  } catch {
    // Ignore missing-file cleanup errors.
  }
};

self.onmessage = async () => {
  const filename = '/test-opfs-wl-worker.sqlite3';

  try {
    await cleanupOpfsFile(filename);

    const sqlite3 = await sqlite3InitModule();
    let db = new sqlite3.oo1.OpfsWlDb(filename, 'ct');

    try {
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      db.exec({
        sql: 'INSERT INTO test (name) VALUES (?), (?)',
        bind: ['Alice', 'Bob'],
      });

      const rows = db.selectObjects('SELECT * FROM test ORDER BY id');
      db.close();
      db = null;

      db = new sqlite3.oo1.OpfsWlDb(filename, 'w');
      const persistedCount = db.selectValue('SELECT count(*) FROM test');

      self.postMessage({
        type: 'success',
        rows,
        persistedCount,
      });
    } finally {
      db?.close();
      await cleanupOpfsFile(filename);
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message, stack: err.stack });
  }
};
