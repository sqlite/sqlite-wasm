import {ExecuteSqlMessage} from "./messages/execute-sql.message";
import {CreateDatabaseMessage} from "./messages/create-database.message";
import {SqliteMessageInterface} from "./interfaces/sqlite-message.interface";
import {SqliteMessageTypeEnum} from "./enums/sqlite-message-type.enum";
import {ExecuteSqlResultMessage} from "./messages/execute-sql-result.message";
import { default as sqlite3InitModule } from '../sqlite-wasm/jswasm/sqlite3-bundler-friendly.mjs';

export class Sqlite {
  private queuedPromises: {[hash in string]: {resolve: (...args) => void, reject: (...args) => void}} = {}

  private worker: Worker;

  constructor(private readonly filename: string, private sqliteWorkerPath: string) {
  }

  public init() {
    this.worker = new Worker(this.sqliteWorkerPath, {
      type: "module", // You need module for the '@sqlite.org/sqlite-wasm' library.
    })
    this.worker.onmessage = this.messageReceived.bind(this);

    const createDatabaseMessage = new CreateDatabaseMessage(this.filename);
    this.worker.postMessage(createDatabaseMessage);

    return new Promise<any>( (resolve, reject) => {
      this.queuedPromises[createDatabaseMessage.uniqueId] =  {
        resolve,
        reject,
      };
    });
  }

  private messageReceived(message: MessageEvent) {
    const sqliteMessage = message.data as SqliteMessageInterface;
    if(sqliteMessage.uniqueId !== undefined && this.queuedPromises.hasOwnProperty(sqliteMessage.uniqueId)) {
      const promise = this.queuedPromises[sqliteMessage.uniqueId];
      delete this.queuedPromises[sqliteMessage.uniqueId];

      switch (sqliteMessage.type) {
        case SqliteMessageTypeEnum.ExecuteSqlResult:
          return promise.resolve( (sqliteMessage as ExecuteSqlResultMessage).result);
        case SqliteMessageTypeEnum.CreateDatabaseResult:
          return promise.resolve();
      }
    }
  }


  public executeSql(sqlStatement: string, bindParameters: (string|number)[] = []): Promise<any> {
    const executeSqlMessage = new ExecuteSqlMessage(sqlStatement, bindParameters);

    this.worker.postMessage(executeSqlMessage);

    return new Promise<any>( (resolve, reject) => {
      this.queuedPromises[executeSqlMessage.uniqueId] =  {
        resolve,
        reject,
      };
    });
  }
}


export default sqlite3InitModule;