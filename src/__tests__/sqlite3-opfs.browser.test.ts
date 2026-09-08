import { describe, expect, test } from 'vitest';
import type { SqlValue } from '../index';

type WorkerSuccessMessage = {
  type: 'success';
  rows: Record<string, SqlValue>[];
  persistedCount: SqlValue | undefined;
};

const createWorker = (workerUrl: URL): Worker =>
  new Worker(workerUrl, {
    type: 'module',
  });

const runWorker = async (workerUrl: URL): Promise<void> => {
  const worker = createWorker(workerUrl);

  try {
    const result = await new Promise<WorkerSuccessMessage>((resolve, reject) => {
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

    expect(result.type).toBe('success');
    expect(result.rows).toEqual([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
    expect(result.persistedCount).toBe(2);
  } finally {
    worker.terminate();
  }
};

describe('opfs persistence APIs', () => {
  test.each([
    ['default entry', './workers/sqlite3-opfs.worker.ts'],
    ['treeshakable entry', './workers/sqlite3-opfs-treeshakable.worker.ts'],
  ])('OpfsDb sanity check in Worker (browser, %s)', async (_label, workerPath) => {
    await runWorker(new URL(workerPath, import.meta.url));
  });

  test.each([
    ['default entry', './workers/sqlite3-opfs-wl.worker.ts'],
    ['treeshakable entry', './workers/sqlite3-opfs-wl-treeshakable.worker.ts'],
  ])('OpfsWlDb sanity check in Worker (browser, %s)', async (_label, workerPath) => {
    await runWorker(new URL(workerPath, import.meta.url));
  });
});
