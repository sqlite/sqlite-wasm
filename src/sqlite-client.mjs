const log = (...args) => console.log(...args);
const error = (...args) => console.error(...args);

export default class SqliteClient {
  sqliteWorker;

  dbFile = '';
  sqliteWorkerPath = '';

  constructor(dbFile, sqliteWorkerPath) {
    if (typeof dbFile !== 'string') {
      return error(
        "The 'dbFile' parameter passed to the SqliteClient constructor must be of type 'string'. Instead, you passed: '" +
          typeof dbFile +
          "'",
      );
    }

    if (typeof sqliteWorkerPath !== 'string') {
      return error(
        "The 'sqliteWorkerPath' parameter passed to the SqliteClient constructor must be of type 'string'. Instead, you passed: '" +
          typeof sqliteWorkerPath +
          "'",
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
      return error(
        "The 'sqlStatement' parameter passed to the 'executeSql' method of the SqliteClient must be of type 'string'. Instead, you passed: '" +
          typeof sqlStatement +
          "'",
      );
    }

    if (!Array.isArray(bindParameters)) {
      return error(
        "The 'bindParameters' parameter passed to the 'executeSql' method of the SqliteClient must be of type 'array'. Instead, you passed: '" +
          typeof bindParameters +
          "'",
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
