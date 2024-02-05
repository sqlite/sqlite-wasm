import sqlite3InitModule from '../index.mjs';
import { getSampleData } from "./sample-data.mjs";

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

    // create table if not exists
    db.exec({
      sql: "CREATE TABLE IF NOT EXISTS MT_DD02L ( TABNAME VARCHAR PRIMARY KEY , AS4LOCAL VARCHAR , AS4VERS VARCHAR , TABCLASS VARCHAR , SQLTAB VARCHAR , DATMIN VARCHAR , DATMAX VARCHAR , DATAVG VARCHAR , CLIDEP VARCHAR , BUFFERED VARCHAR , COMPRFLAG VARCHAR , LANGDEP VARCHAR , ACTFLAG VARCHAR , APPLCLASS VARCHAR , AUTHCLASS VARCHAR , AS4USER VARCHAR , AS4DATE VARCHAR , AS4TIME VARCHAR , MASTERLANG VARCHAR , MAINFLAG VARCHAR , CONTFLAG VARCHAR , RESERVETAB VARCHAR , GLOBALFLAG VARCHAR , PROZPUFF VARCHAR , VIEWCLASS VARCHAR , VIEWGRANT VARCHAR , MULTIPLEX VARCHAR , SHLPEXI VARCHAR , PROXYTYPE VARCHAR , EXCLASS VARCHAR , WRONGCL VARCHAR);",
    });

    // Start time
    const startTime = performance.now();

    // db.exec('PRAGMA journal_mode = OFF;');

    // db.exec({
    //   sql: "DELETE FROM MT_DD02L;",
    // }); 
    
    db.exec({
      sql: "BEGIN;",
    });

    const sql = `INSERT OR REPLACE INTO MT_DD02L 
    (TABNAME, AS4LOCAL, AS4VERS, TABCLASS, SQLTAB, DATMIN, DATMAX, DATAVG, CLIDEP, BUFFERED, 
    COMPRFLAG, LANGDEP, ACTFLAG, APPLCLASS, AUTHCLASS, AS4USER, AS4DATE, AS4TIME, MASTERLANG, 
    MAINFLAG, CONTFLAG, RESERVETAB, GLOBALFLAG, PROZPUFF, VIEWCLASS, VIEWGRANT, MULTIPLEX, 
    SHLPEXI, PROXYTYPE, EXCLASS, WRONGCL) VALUES 
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

    const stmt = db.prepare(sql);

    const sampleData = getSampleData();
    for (let i = 0; i < sampleData.length; i++) {
      // Bind values from the row to the statement
      stmt.bind(sampleData[i]);

      // Execute the statement
      stmt.step();

      // Reset the statement to be used again
      stmt.reset();

      // Check if the current index + 1 is a multiple of 50
      if ((i + 1) % 50000 === 0) {
        log(`Processed ${i + 1} records...`);
      }
    }

    db.exec({
      sql: "COMMIT;",
    });

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
