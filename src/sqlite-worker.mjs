import * as Comlink from './comlink.mjs';
import { default as sqlite3InitModule } from '../index.mjs';

const log = (...args) => console.log(...args);
const error = (...args) => console.error(...args);

class SqliteWorker {
  db;
  init(dbFile) {
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
        rowMode: 'array',
      }),
    );
  }
}

Comlink.expose(SqliteWorker);
