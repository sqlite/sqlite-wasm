// @ts-expect-error Generated runtime bundle has no declaration file.
import sqlite3InitModule from '../../bin/sqlite3-core-opfs-sahpool-bundler-friendly.mjs';

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);
const getErrorStack = (err: unknown): string | undefined =>
  err instanceof Error ? err.stack : undefined;

self.onmessage = async () => {
  try {
    const sqlite3 = await sqlite3InitModule();
    const opfsSahPool = await sqlite3.installOpfsSAHPoolVfs({
      name: 'opfs-sahpool-omit-api',
      clearOnInit: true,
    });
    const db = new opfsSahPool.OpfsSAHPoolDb('/omit-api-sah-pool-worker.sqlite3');

    try {
      db.exec('CREATE TABLE t(value); INSERT INTO t(value) VALUES (17)');
      if (db.selectValue('SELECT value FROM t') !== 17) {
        throw new Error('SAH Pool omit-api query check failed');
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
      db.close();
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: getErrorMessage(err), stack: getErrorStack(err) });
  }
};
