import { expect, test } from 'vitest';

type WorkerMessage = {
  type: 'success';
};

const runWorker = async (workerUrl: URL): Promise<void> => {
  const worker = new Worker(workerUrl, { type: 'module' });

  try {
    const result = await new Promise<WorkerMessage>((resolve, reject) => {
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
  } finally {
    worker.terminate();
  }
};

test('core runtime initializes without optional VFS modules', async () => {
  await runWorker(new URL('./workers/sqlite3-core.worker.ts', import.meta.url));
});

test('core runtime can opt into only kvvfs', async () => {
  await runWorker(new URL('./workers/sqlite3-core-kvvfs.worker.ts', import.meta.url));
});

test('core runtime can opt into only vtab helpers', async () => {
  await runWorker(new URL('./workers/sqlite3-core-vtab.worker.ts', import.meta.url));
});
