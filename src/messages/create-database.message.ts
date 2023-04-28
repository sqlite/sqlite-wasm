import {SqliteMessageInterface} from "../interfaces/sqlite-message.interface";
import {SqliteMessageTypeEnum} from "../enums/sqlite-message-type.enum";

export class CreateDatabaseMessage implements SqliteMessageInterface {
  type: SqliteMessageTypeEnum = SqliteMessageTypeEnum.CreateDatabase;
  uniqueId: string = crypto.randomUUID();
  constructor(public readonly filename: string) {
  }
}
