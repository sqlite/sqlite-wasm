const worker = new Worker(new URL('./workers/worker.ts', import.meta.url), {
  type: 'module',
});

worker.onmessage = (e) => {
  if (e.data.type === 'success') {
    const app = document.getElementById('app');
    if (app) {
      const file = document.createElement('p');
      file.textContent = `Stored in OPFS file ${e.data.filename}`;
      app.appendChild(file);

      const ul = document.createElement('ul');
      e.data.rows.forEach((row: any) => {
        const li = document.createElement('li');
        li.textContent = `${row.id}: ${row.name}`;
        ul.appendChild(li);
      });
      app.appendChild(ul);
    }
  } else if (e.data.type === 'error') {
    console.error(e.data.message);
  }
};

worker.postMessage({ type: 'start' });
