import {SqliteMessageInterface} from "../interfaces/sqlite-message.interface";
import {SqliteMessageTypeEnum} from "../enums/sqlite-message-type.enum";

export class CreateDatabaseResultMessage implements SqliteMessageInterface {
  type: SqliteMessageTypeEnum = SqliteMessageTypeEnum.CreateDatabaseResult;

  constructor(public readonly uniqueId: string) {
  }
}
