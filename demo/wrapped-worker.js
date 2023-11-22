import { sqlite3Worker1Promiser } from '../index.mjs';

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

    await promiser('exec', { dbId, sql: 'CREATE TABLE IF NOT EXISTS t(a,b)' });
    logHtml('', 'Creating a table...');

    logHtml('', 'Insert some data using exec()...');
    for (let i = 20; i <= 25; ++i) {
      await promiser('exec', {
        dbId,
        sql: 'INSERT INTO t(a,b) VALUES (?,?)',
        bind: [i, i * 2],
      });
    }

    logHtml('', 'Query data with exec()');
    await promiser('exec', {
      dbId,
      sql: 'SELECT a FROM t ORDER BY a LIMIT 3',
      callback: (result) => {
        if (!result.row) {
          return;
        }
        logHtml('', result.row);
      },
    });

    await promiser('close', { dbId });
  } catch (err) {
    if (!(err instanceof Error)) {
      err = new Error(err.result.message);
    }
    console.error(err.name, err.message);
  }
})();
