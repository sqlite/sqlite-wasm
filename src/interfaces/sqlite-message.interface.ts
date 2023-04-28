import {SqliteMessageTypeEnum} from "../enums/sqlite-message-type.enum";

export interface SqliteMessageInterface {
  type: SqliteMessageTypeEnum;

  uniqueId: string;
}
