import { expect, test } from 'vitest';

test('OpfsSAHPoolVfs sanity check in Worker (browser)', async () => {
  const worker = new Worker(
    new URL('./workers/sqlite3-sahpool.worker.js', import.meta.url),
    {
      type: 'module',
    },
  );

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
  worker.terminate();
});
