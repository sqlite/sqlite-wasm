import {SqliteMessageInterface} from "../interfaces/sqlite-message.interface";
import {SqliteMessageTypeEnum} from "../enums/sqlite-message-type.enum";

export class ExecuteSqlResultMessage implements SqliteMessageInterface {
  type: SqliteMessageTypeEnum = SqliteMessageTypeEnum.ExecuteSqlResult;

  constructor(public readonly uniqueId: string,
              public readonly result: string[]) {
  }

}
