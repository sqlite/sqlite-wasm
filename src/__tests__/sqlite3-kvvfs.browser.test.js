import { expect, test, describe } from 'vitest';
import sqlite3InitModule from '../bin/sqlite3-bundler-friendly.mjs';

describe('kvvfs', () => {
  test('kvvfs basic sanity check (browser)', async () => {
    const sqlite3 = await sqlite3InitModule();
    const { kvvfs } = sqlite3;

    expect(kvvfs).toBeDefined();
    expect(kvvfs.exists('.')).toBe(true);

    if (typeof window !== 'undefined' && window.localStorage) {
      expect(kvvfs.exists('local')).toBe(true);
    }
    if (typeof window !== 'undefined' && window.sessionStorage) {
      expect(kvvfs.exists('session')).toBe(true);
    }

    const db = new sqlite3.oo1.DB('file:temp?vfs=kvvfs', 'c');
    try {
      db.exec('CREATE TABLE t(a,b); INSERT INTO t(a,b) VALUES(1,2),(3,4);');
      const rows = db.selectArrays('SELECT * FROM t ORDER BY a');
      expect(rows).toEqual([
        [1, 2],
        [3, 4],
      ]);

      const size = kvvfs.estimateSize('temp');
      expect(size).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });

  test('kvvfs persistence check (session storage)', async () => {
    const sqlite3 = await sqlite3InitModule();
    const { kvvfs } = sqlite3;

    const dbName = 'file:persisTest?vfs=kvvfs';

    // Clean up if it already exists
    kvvfs.unlink('persisTest');

    let db = new sqlite3.oo1.DB(dbName, 'c');
    try {
      db.exec('CREATE TABLE t(a); INSERT INTO t(a) VALUES(100);');
    } finally {
      db.close();
    }

    // Re-open
    db = new sqlite3.oo1.DB(dbName, 'c');
    try {
      const val = db.selectValue('SELECT a FROM t');
      expect(val).toBe(100);
    } finally {
      db.close();
      kvvfs.unlink('persisTest');
    }
  });

  test('kvvfs utility methods', async () => {
    const sqlite3 = await sqlite3InitModule();
    const { kvvfs } = sqlite3;

    const name = 'utilTest';
    const dbName = `file:${name}?vfs=kvvfs`;

    kvvfs.unlink(name);
    const db = new sqlite3.oo1.DB(dbName, 'c');
    try {
      db.exec('CREATE TABLE t(a); INSERT INTO t(a) VALUES(1);');

      const size = kvvfs.estimateSize(name);
      expect(size).toBeGreaterThan(0);

      expect(kvvfs.exists(name)).toBe(true);
    } finally {
      db.close();
      kvvfs.unlink(name);
      expect(kvvfs.exists(name)).toBe(false);
    }
  });

  test('repro issue 146: kvvfs xFileControl [TypeError: Cannot read properties of undefined (reading "disablePageSizeChange")]', async () => {
    const sqlite3 = await sqlite3InitModule();
    const { kvvfs } = sqlite3;
    const db = new sqlite3.oo1.DB('file:repro146?vfs=kvvfs', 'c');
    try {
      // The issue was that kvvfs.internal was only defined if kvvfs.log was defined.
      // However, xFileControl unconditionally accessed kvvfs.internal.disablePageSizeChange.

      // Trigger xFileControl with SQLITE_FCNTL_PRAGMA for page_size
      db.exec('PRAGMA page_size;');

      // This should also trigger it
      db.exec('PRAGMA page_size = 4096;');

      // VACUUM often triggers various file controls
      db.exec('VACUUM;');

      // Verify no errors were captured in kvvfs cache
      const lastError = kvvfs.internal.cache.popError();
      expect(lastError).toBeUndefined();
    } finally {
      db.close();
      sqlite3.kvvfs.unlink('repro146');
    }
  });
});
