import sqlite3InitModule from '../../browser-core';

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

self.onmessage = async () => {
  try {
    const sqlite3 = await sqlite3InitModule();

    if (sqlite3.vfs !== undefined) {
      throw new Error('sqlite3.vfs should not be installed by the core entry');
    }
    if (sqlite3.kvvfs !== undefined) {
      throw new Error('sqlite3.kvvfs should not be installed by the core entry');
    }
    if (sqlite3.oo1.OpfsDb !== undefined || sqlite3.oo1.OpfsWlDb !== undefined) {
      throw new Error('OPFS DB constructors should not be installed by the core entry');
    }
    if (sqlite3.vtab !== undefined) {
      throw new Error('sqlite3.vtab should not be installed by the core entry');
    }
    if (sqlite3.initWorker1API !== undefined) {
      throw new Error('Worker API #1 should not be installed by the core entry');
    }

    const db = new sqlite3.oo1.DB(':memory:');
    try {
      db.exec('CREATE TABLE t(a); INSERT INTO t(a) VALUES(1);');
      if (db.selectValue('SELECT a FROM t') !== 1) {
        throw new Error('Core sqlite3 sanity check failed');
      }
    } finally {
      db.close();
    }

    self.postMessage({ type: 'success' });
  } catch (err) {
    self.postMessage({ type: 'error', message: getErrorMessage(err) });
  }
};
