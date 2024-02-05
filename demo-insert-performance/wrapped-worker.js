import { sqlite3Worker1Promiser } from '../index.mjs';
import { getSampleQueries } from "./sample-queries.mjs";

(async () => {
  const container = document.querySelector('.worker-promiser');

  const logHtml = function (cssClass, ...args) {
    const div = document.createElement('div');
    if (cssClass) div.classList.add(cssClass);
    div.append(document.createTextNode(args.join(' ')));
    container.append(div);
  };

  try {
    logHtml('', 'Loading and initializing SQLite3 module...');

    const promiser = await new Promise((resolve) => {
      const _promiser = sqlite3Worker1Promiser({
        onready: () => {
          resolve(_promiser);
        },
      });
    });

    logHtml('', 'Done initializing. Running demo...');

    let response;

    response = await promiser('config-get', {});
    logHtml('', 'Running SQLite3 version', response.result.version.libVersion);

    response = await promiser('open', {
      filename: 'file:worker-promiser.sqlite3?vfs=opfs',
    });
    const { dbId } = response;
    logHtml(
      '',
      'OPFS is available, created persisted database at',
      response.result.filename.replace(/^file:(.*?)\?vfs=opfs/, '$1'),
    );


    logHtml('','INSERT a lot of data');
    // Start time
    const startTime = performance.now();

    const sampleQueries = getSampleQueries();

    // await promiser('exec', { dbId, sql: 'PRAGMA journal_mode = OFF;' });

    for (let i = 0; i < sampleQueries.length; i++) {
      await promiser('exec', { dbId, sql: sampleQueries[i] });
      // Check if the current index + 1 is a multiple of 50
      if ((i + 1) % 50 === 0) {
        logHtml('',`Processed ${i + 1} records...`);
      }
    }
    logHtml('',"DONE!")

    // End time
    const endTime = performance.now();

    // Calculate total runtime
    const totalTime = endTime - startTime;
    logHtml('',`Table creation and data insertion completed in ${totalTime.toFixed(2)} milliseconds.`);

    await promiser('close', { dbId });
  } catch (err) {
    if (!(err instanceof Error)) {
      err = new Error(err.result.message);
    }
    console.error(err.name, err.message);
  }
})();
