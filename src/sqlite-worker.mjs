import * as Comlink from './comlink.mjs';
import { default as sqlite3InitModule } from '../index.mjs';

const log = (...args) => console.log(...args);
const error = (...args) => console.error(...args);

class SqliteWorker {
  db;
  rowMode = 'object';
  init(dbFile, rowMode) {
    if (rowMode && rowMode !== 'array' && rowMode !== 'object') {
      throw new Error('Invalid rowMode');
    }
    this.rowMode = rowMode || this.rowMode;
    return new Promise((resolve) => {
      sqlite3InitModule({
        print: log,
        printErr: error,
      }).then((sqlite3) => {
        try {
          this.db = new sqlite3.oo1.OpfsDb(dbFile);
        } catch (err) {
          error(err.name, err.message);
        }

        return resolve();
      });
    });
  }

  executeSql(sqlStatement, bindParameters, callback) {
    return callback(
      this.db.exec({
        sql: sqlStatement,
        bind: bindParameters,
        returnValue: 'resultRows',
        rowMode: this.rowMode,
      }),
    );
  }
}

Comlink.expose(SqliteWorker);
