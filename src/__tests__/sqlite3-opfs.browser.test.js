import { describe, expect, test } from 'vitest';

const createWorker = (workerUrl) =>
  new Worker(workerUrl, {
    type: 'module',
  });

const runWorker = async (workerUrl) => {
  const worker = createWorker(workerUrl);

  try {
    const result = await new Promise((resolve, reject) => {
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
  test('OpfsDb sanity check in Worker (browser)', async () => {
    await runWorker(new URL('./workers/sqlite3-opfs.worker.js', import.meta.url));
  });

  test('OpfsWlDb sanity check in Worker (browser)', async () => {
    await runWorker(new URL('./workers/sqlite3-opfs-wl.worker.js', import.meta.url));
  });
});
