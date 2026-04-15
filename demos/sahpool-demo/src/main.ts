const worker = new Worker(new URL('./workers/worker.ts', import.meta.url), {
  type: 'module',
});

worker.onmessage = (e) => {
  if (e.data.type === 'success') {
    const rows = e.data.rows;
    const app = document.getElementById('app');
    if (app) {
      const ul = document.createElement('ul');
      rows.forEach((row: any) => {
        const li = document.createElement('li');
        li.textContent = `${row.id}: ${row.name}`;
        ul.appendChild(li);
      });
      app.appendChild(ul);
    }
  }
};

worker.postMessage({ type: 'start' });
