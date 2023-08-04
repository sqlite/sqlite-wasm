import * as Comlink from './comlink.mjs';

export class SqliteClient {
  sqliteWorker;

  dbFile = '';
  sqliteWorkerPath = '';

  constructor(dbFile, sqliteWorkerPath) {
    if (typeof dbFile !== 'string') {
      throw new Error(
        `The 'dbFile' parameter passed to the 'SqliteClient' constructor must be of type 'string'. Instead, you passed: '${typeof dbFile}'.`,
      );
    }

    if (typeof sqliteWorkerPath !== 'string') {
      throw new Error(
        `The 'sqliteWorkerPath' parameter passed to the 'SqliteClient' constructor must be of type 'string'. Instead, you passed: '${typeof sqliteWorkerPath}'.`,
      );
    }

    this.dbFile = dbFile;
    this.sqliteWorkerPath = sqliteWorkerPath;
  }

  async init() {
    const SqliteWorker = Comlink.wrap(
      new Worker(this.sqliteWorkerPath, {
        type: 'module',
      }),
    );

    this.sqliteWorker = await new SqliteWorker();

    await this.sqliteWorker.init(this.dbFile);
  }

  async executeSql(sqlStatement, bindParameters = []) {
    if (typeof sqlStatement !== 'string') {
      throw new Error(
        `The 'sqlStatement' parameter passed to the 'executeSql' method of the 'SqliteClient' must be of type 'string'. Instead, you passed: '${typeof sqlStatement}'.`,
      );
    }

    if (!Array.isArray(bindParameters)) {
      throw new Error(
        `The 'bindParameters' parameter passed to the 'executeSql' method of the 'SqliteClient' must be of type 'array'. Instead, you passed: '${typeof bindParameters}'.`,
      );
    }

    return new Promise(async (resolve) => {
      await this.sqliteWorker.executeSql(
        sqlStatement,
        bindParameters,
        Comlink.proxy((rows) => {
          return resolve(rows);
        }),
      );
    });
  }
}
