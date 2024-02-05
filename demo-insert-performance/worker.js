import sqlite3InitModule from '../index.mjs';
import { getSampleQueries } from "./sample-queries.mjs";

const logHtml = function (cssClass, ...args) {
  postMessage({
    type: 'log',
    payload: { cssClass, args },
  });
};

const log = (...args) => logHtml('', ...args);
const error = (...args) => logHtml('error', ...args);

const start = function (sqlite3) {
  log('Running SQLite3 version', sqlite3.version.libVersion);
  let db;
  
  if ('opfs' in sqlite3) {
    db = new sqlite3.oo1.OpfsDb('/mydb.sqlite3');
    log('OPFS is available, created persisted database at', db.filename);
  } else {
    db = new sqlite3.oo1.DB('/mydb.sqlite3', 'ct');
    log('OPFS is not available, created transient database', db.filename);
  }

  try {
    log('INSERT a lot of data');
    // Start time
    const startTime = performance.now();

    const sampleQueries = getSampleQueries();
    
    // db.exec('PRAGMA journal_mode = OFF;');
    
    db.exec('BEGIN TRANSACTION;');

    for (let i = 0; i < sampleQueries.length; i++) {
      db.exec(sampleQueries[i]);
      // Check if the current index + 1 is a multiple of 50
      if ((i + 1) % 50 === 0) {
        log(`Processed ${i + 1} records...`);
      }
    }
    
    db.exec('COMMIT;');

    log("DONE!")

    // End time
    const endTime = performance.now();

    // Calculate total runtime
    const totalTime = endTime - startTime;
    log(`Table creation and data insertion completed in ${totalTime.toFixed(2)} milliseconds.`);

  } finally {
    db.close();
  }
};

log('Loading and initializing SQLite3 module...');
sqlite3InitModule({
  print: log,
  printErr: error,
}).then((sqlite3) => {
  log('Done initializing. Running demo...');
  try {
    start(sqlite3);
  } catch (err) {
    error(err.name, err.message);
  }
});
