const container = document.querySelector('.worker');

const logHtml = (cssClass, ...args) => {
  const div = document.createElement('div');
  if (cssClass) div.classList.add(cssClass);
  div.append(document.createTextNode(args.join(' ')));
  container.append(div);
};

(async () => {
  // Module Worker polyfill from https://stackoverflow.com/a/62963963/6255000.
  const supportsWorkerType = () => {
    let supports = false;
    const tester = {
      get type() {
        supports = true;
      },
    };
    try {
      new Worker('data:,""', tester);
    } finally {
      return supports;
    }
  };
  if (!supportsWorkerType()) {
    await import('./module-workers-polyfill.min.js');
  }

  const worker = new Worker('/demo/worker.js', {
    type: 'module',
  });

  worker.addEventListener('message', ({ data }) => {
    switch (data.type) {
      case 'log':
        logHtml(data.payload.cssClass, ...data.payload.args);
        break;
      default:
        logHtml('error', 'Unhandled message:', data.type);
    }
  });
})();
