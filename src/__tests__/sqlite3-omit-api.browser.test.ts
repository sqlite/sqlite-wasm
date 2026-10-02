import { describe, expect, test } from 'vitest';

// @ts-expect-error Generated runtime bundle has no declaration file.
import coreInitModule from '../bin/sqlite3-core-bundler-friendly.mjs';
// @ts-expect-error Generated runtime bundle has no declaration file.
import vtabInitModule from '../bin/sqlite3-core-vtab-bundler-friendly.mjs';
// @ts-expect-error Generated runtime bundle has no declaration file.
import kvvfsInitModule from '../bin/sqlite3-core-kvvfs-bundler-friendly.mjs';

type WorkerSuccessMessage = {
  type: 'success';
  features: {
    worker1: boolean;
    vtab: boolean;
    kvvfs: boolean;
    opfsDb: boolean;
    opfsWlDb: boolean;
    sahPool: boolean;
  };
};

const runWorker = async (workerUrl: URL): Promise<WorkerSuccessMessage> => {
  const worker = new Worker(workerUrl, { type: 'module' });

  try {
    return await new Promise<WorkerSuccessMessage>((resolve, reject) => {
      worker.onmessage = (e) => {
        if (e.data.type === 'success') {
          resolve(e.data);
        } else {
          reject(new Error(e.data.message || 'Unknown worker error'));
        }
      };
      worker.onerror = (e) => {
        reject(new Error('Worker error: ' + e.message));
      };
      worker.postMessage({ type: 'start' });
    });
  } finally {
    worker.terminate();
  }
};

describe('omit-api generated scripts in browser contexts', () => {
  test('core omits optional APIs and Worker1 on the main thread', async () => {
    const sqlite3 = await coreInitModule();
    const db = new sqlite3.oo1.DB(':memory:');

    try {
      db.exec('CREATE TABLE t(value); INSERT INTO t(value) VALUES (1)');
      expect(db.selectValue('SELECT value FROM t')).toBe(1);
    } finally {
      db.close();
    }

    expect('initWorker1API' in sqlite3).toBe(false);
    expect(sqlite3.Worker1Promiser).toBeUndefined();
    expect(
      (globalThis as { sqlite3Worker1Promiser?: unknown }).sqlite3Worker1Promiser,
    ).toBeUndefined();
    expect(sqlite3.vtab).toBeUndefined();
    expect(sqlite3.kvvfs).toBeUndefined();
    expect(sqlite3.oo1.OpfsDb).toBeUndefined();
    expect(sqlite3.oo1.OpfsWlDb).toBeUndefined();
    expect(sqlite3.installOpfsSAHPoolVfs).toBeUndefined();
  });

  test('vtab variant exposes virtual table helpers without Worker1', async () => {
    const sqlite3 = await vtabInitModule();

    expect('initWorker1API' in sqlite3).toBe(false);
    expect(sqlite3.vtab).toBeDefined();
    expect(sqlite3.kvvfs).toBeUndefined();
    expect(sqlite3.oo1.OpfsDb).toBeUndefined();
    expect(sqlite3.installOpfsSAHPoolVfs).toBeUndefined();
  });

  test('kvvfs variant can create a kvvfs database on the main thread', async () => {
    const sqlite3 = await kvvfsInitModule();
    const name = 'omitApiKvvfsTest';

    sqlite3.kvvfs.unlink(name);
    const db = new sqlite3.oo1.DB(`file:${name}?vfs=kvvfs`, 'c');

    try {
      db.exec('CREATE TABLE t(value); INSERT INTO t(value) VALUES (7)');
      expect(db.selectValue('SELECT value FROM t')).toBe(7);
      expect(sqlite3.kvvfs.exists(name)).toBe(true);
    } finally {
      db.close();
      sqlite3.kvvfs.unlink(name);
    }

    expect('initWorker1API' in sqlite3).toBe(false);
    expect(sqlite3.vtab).toBeUndefined();
    expect(sqlite3.oo1.OpfsDb).toBeUndefined();
    expect(sqlite3.installOpfsSAHPoolVfs).toBeUndefined();
  });

  test('opfs variant works in a Worker without Worker1', async () => {
    const result = await runWorker(
      new URL('./workers/sqlite3-omit-opfs.worker.ts', import.meta.url),
    );

    expect(result.features).toEqual({
      worker1: false,
      vtab: false,
      kvvfs: false,
      opfsDb: true,
      opfsWlDb: false,
      sahPool: false,
    });
  });

  test('opfs-wl variant works in a Worker without Worker1', async () => {
    const result = await runWorker(
      new URL('./workers/sqlite3-omit-opfs-wl.worker.ts', import.meta.url),
    );

    expect(result.features).toEqual({
      worker1: false,
      vtab: false,
      kvvfs: false,
      opfsDb: false,
      opfsWlDb: true,
      sahPool: false,
    });
  });

  test('sah-pool variant works in a Worker without Worker1', async () => {
    const result = await runWorker(
      new URL('./workers/sqlite3-omit-sah-pool.worker.ts', import.meta.url),
    );

    expect(result.features).toEqual({
      worker1: false,
      vtab: false,
      kvvfs: false,
      opfsDb: false,
      opfsWlDb: false,
      sahPool: true,
    });
  });
});
