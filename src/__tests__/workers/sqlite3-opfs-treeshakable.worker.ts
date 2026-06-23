import '../../vfs/opfs';
import sqlite3InitModule from '../../browser-core';

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);
const getErrorStack = (err: unknown): string | undefined =>
  err instanceof Error ? err.stack : undefined;

const cleanupOpfsFile = async (filename: string): Promise<void> => {
  const entryName = filename.replace(/^\//, '');

  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(entryName);
  } catch {
    // Ignore missing-file cleanup errors.
  }
};

self.onmessage = async () => {
  const filename = '/test-opfs-worker.sqlite3';

  try {
    await cleanupOpfsFile(filename);

    const sqlite3 = await sqlite3InitModule();
    let db: InstanceType<typeof sqlite3.oo1.OpfsDb> | undefined = new sqlite3.oo1.OpfsDb(
      filename,
      'ct',
    );

    try {
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      db.exec({
        sql: 'INSERT INTO test (name) VALUES (?), (?)',
        bind: ['Alice', 'Bob'],
      });

      const rows = db.selectObjects('SELECT * FROM test ORDER BY id');
      db.close();
      db = undefined;

      db = new sqlite3.oo1.OpfsDb(filename, 'w');
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
    self.postMessage({ type: 'error', message: getErrorMessage(err), stack: getErrorStack(err) });
  }
};
