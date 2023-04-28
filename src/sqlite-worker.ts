import {SqliteMessageTypeEnum} from "./enums/sqlite-message-type.enum";
import {CreateDatabaseMessage} from "./messages/create-database.message";
import {SqliteMessageInterface} from "./interfaces/sqlite-message.interface";
import {CreateDatabaseResultMessage} from "./messages/create-database-result.message";
import {default as sqlite3InitModule} from "../sqlite-wasm/jswasm/sqlite3.mjs";
import {ExecuteSqlMessage} from "./messages/execute-sql.message";
import {ExecuteSqlResultMessage} from "./messages/execute-sql-result.message";

let db;
const log = (...args) => console.log(...args);
const error = (...args) => console.error(...args);

self.onmessage = (messageEvent: MessageEvent) => {
  const sqliteMessage = messageEvent.data as SqliteMessageInterface;

  switch (sqliteMessage.type) {
    case SqliteMessageTypeEnum.CreateDatabase:
      sqlite3InitModule({
        print: log,
        printErr: error,
      }).then((sqlite3) => {
        try {
          db = new sqlite3.oo1.OpfsDb((sqliteMessage as CreateDatabaseMessage).filename);
          self.postMessage(new CreateDatabaseResultMessage((sqliteMessage as CreateDatabaseMessage).uniqueId));
        } catch (err) {
          error(err.name, err.message);
        }
      });
    break;
    case SqliteMessageTypeEnum.ExecuteSql:
      // Execute the sql command.
      // Check if the database exists and if yes,
      const executeSqlMessage = sqliteMessage as ExecuteSqlMessage;

      const result = db.exec({
        sql: executeSqlMessage.sqlStatement,
        bind: executeSqlMessage.bindingParameters,
        returnValue: "resultRows",
        rowMode: 'array',
      });
      self.postMessage(new ExecuteSqlResultMessage(executeSqlMessage.uniqueId, result));
      break;
  }
}

