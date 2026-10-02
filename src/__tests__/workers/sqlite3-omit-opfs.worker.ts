// @ts-expect-error Generated runtime bundle has no declaration file.
import sqlite3InitModule from '../../bin/sqlite3-core-opfs-bundler-friendly.mjs';

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
  const filename = '/omit-api-opfs-worker.sqlite3';

  try {
    await cleanupOpfsFile(filename);

    const sqlite3 = await sqlite3InitModule();
    let db: InstanceType<typeof sqlite3.oo1.OpfsDb> | undefined = new sqlite3.oo1.OpfsDb(
      filename,
      'ct',
    );

    try {
      db.exec('CREATE TABLE t(value); INSERT INTO t(value) VALUES (11)');
      db.close();
      db = undefined;

      db = new sqlite3.oo1.OpfsDb(filename, 'w');
      if (db.selectValue('SELECT value FROM t') !== 11) {
        throw new Error('OPFS omit-api persistence check failed');
      }

      self.postMessage({
        type: 'success',
        features: {
          worker1: 'initWorker1API' in sqlite3,
          vtab: Boolean(sqlite3.vtab),
          kvvfs: Boolean(sqlite3.kvvfs),
          opfsDb: Boolean(sqlite3.oo1.OpfsDb),
          opfsWlDb: Boolean(sqlite3.oo1.OpfsWlDb),
          sahPool: Boolean(sqlite3.installOpfsSAHPoolVfs),
        },
      });
    } finally {
      db?.close();
      await cleanupOpfsFile(filename);
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: getErrorMessage(err), stack: getErrorStack(err) });
  }
};
