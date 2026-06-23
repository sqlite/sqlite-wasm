import '../../vtab';
import sqlite3InitModule from '../../browser-core';

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

self.onmessage = async () => {
  try {
    const sqlite3 = await sqlite3InitModule();

    if (sqlite3.vtab === undefined) {
      throw new Error('sqlite3.vtab should be installed by the vtab entry');
    }
    if (sqlite3.vfs !== undefined || sqlite3.kvvfs !== undefined) {
      throw new Error('VFS APIs should not be installed by the vtab entry');
    }
    if (sqlite3.initWorker1API !== undefined) {
      throw new Error('Worker API #1 should not be installed by the vtab entry');
    }

    self.postMessage({ type: 'success' });
  } catch (err) {
    self.postMessage({ type: 'error', message: getErrorMessage(err) });
  }
};
