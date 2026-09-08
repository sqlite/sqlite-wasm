import '../../vfs/kvvfs';
import sqlite3InitModule from '../../browser-core';

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

self.onmessage = async () => {
  try {
    const sqlite3 = await sqlite3InitModule();

    if (sqlite3.vfs === undefined) {
      throw new Error('sqlite3.vfs should be installed by the kvvfs entry');
    }
    if (sqlite3.kvvfs === undefined) {
      throw new Error('sqlite3.kvvfs should be installed by the kvvfs entry');
    }
    if (sqlite3.oo1.OpfsDb !== undefined || sqlite3.installOpfsSAHPoolVfs !== undefined) {
      throw new Error('OPFS VFS APIs should not be installed by the kvvfs entry');
    }
    if (sqlite3.initWorker1API !== undefined) {
      throw new Error('Worker API #1 should not be installed by the kvvfs entry');
    }

    const tempName = 'splitTemp';
    sqlite3.kvvfs.unlink(tempName);
    const tempDb = new sqlite3.oo1.DB(`file:${tempName}?vfs=kvvfs`, 'c');
    try {
      tempDb.exec('CREATE TABLE t(a,b); INSERT INTO t(a,b) VALUES(1,2),(3,4);');
      const rows = tempDb.selectArrays('SELECT * FROM t ORDER BY a');
      if (
        JSON.stringify(rows) !==
        JSON.stringify([
          [1, 2],
          [3, 4],
        ])
      ) {
        throw new Error('kvvfs basic query check failed');
      }

      const size = sqlite3.kvvfs.estimateSize(tempName);
      if (size <= 0) {
        throw new Error('kvvfs size check failed');
      }
    } finally {
      tempDb.close();
      sqlite3.kvvfs.unlink(tempName);
    }

    const persistentName = 'splitPersisTest';
    const persistentDbName = `file:${persistentName}?vfs=kvvfs`;
    sqlite3.kvvfs.unlink(persistentName);

    let persistentDb = new sqlite3.oo1.DB(persistentDbName, 'c');
    try {
      persistentDb.exec('CREATE TABLE t(a); INSERT INTO t(a) VALUES(100);');
    } finally {
      persistentDb.close();
    }

    persistentDb = new sqlite3.oo1.DB(persistentDbName, 'c');
    try {
      if (persistentDb.selectValue('SELECT a FROM t') !== 100) {
        throw new Error('kvvfs persistence check failed');
      }
    } finally {
      persistentDb.close();
      sqlite3.kvvfs.unlink(persistentName);
    }

    const utilityName = 'splitUtilTest';
    sqlite3.kvvfs.unlink(utilityName);
    const db = new sqlite3.oo1.DB(`file:${utilityName}?vfs=kvvfs`, 'c');
    try {
      db.exec('CREATE TABLE t(a); INSERT INTO t(a) VALUES(2);');
      if (db.selectValue('SELECT a FROM t') !== 2) {
        throw new Error('kvvfs utility query check failed');
      }
      if (sqlite3.kvvfs.estimateSize(utilityName) <= 0) {
        throw new Error('kvvfs utility size check failed');
      }
      if (!sqlite3.kvvfs.exists(utilityName)) {
        throw new Error('kvvfs utility exists check failed');
      }
    } finally {
      db.close();
      sqlite3.kvvfs.unlink(utilityName);
      if (sqlite3.kvvfs.exists(utilityName)) {
        throw new Error('kvvfs utility unlink check failed');
      }
    }

    const reproDb = new sqlite3.oo1.DB('file:splitRepro146?vfs=kvvfs', 'c');
    try {
      reproDb.exec('PRAGMA page_size;');
      reproDb.exec('PRAGMA page_size = 4096;');
      reproDb.exec('VACUUM;');
    } finally {
      reproDb.close();
      sqlite3.kvvfs.unlink('splitRepro146');
    }

    self.postMessage({ type: 'success' });
  } catch (err) {
    self.postMessage({ type: 'error', message: getErrorMessage(err) });
  }
};
