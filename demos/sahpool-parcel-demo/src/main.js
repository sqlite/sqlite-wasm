const worker = new Worker(new URL('./workers/worker.js', import.meta.url), {
  type: 'module',
});

worker.onmessage = (e) => {
  if (e.data.type === 'success') {
    const app = document.getElementById('app');
    if (app) {
      const ul = document.createElement('ul');
      e.data.rows.forEach((row) => {
        const li = document.createElement('li');
        li.textContent = `${row.id}: ${row.name}`;
        ul.appendChild(li);
      });
      app.appendChild(ul);
    }
    return;
  }

  console.error(e.data.message);
};

worker.postMessage({ type: 'start' });
