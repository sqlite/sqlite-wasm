import { expect, test } from 'vitest';

type WorkerSuccessMessage = {
  type: 'success';
};

test.each([
  ['default entry', './workers/sqlite3-sahpool.worker.ts'],
  ['treeshakable entry', './workers/sqlite3-sahpool-treeshakable.worker.ts'],
])('OpfsSAHPoolVfs sanity check in Worker (browser, %s)', async (_label, workerPath) => {
  const worker = new Worker(new URL(workerPath, import.meta.url), { type: 'module' });

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
  } finally {
    worker.terminate();
  }
});
