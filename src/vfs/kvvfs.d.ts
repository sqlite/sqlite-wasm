import type { Sqlite3Static } from '../index.js';

declare module '@sqlite.org/sqlite-wasm/core' {
  interface Sqlite3CoreExtensions {
    kvvfs: Sqlite3Static['kvvfs'];
    vfs: Sqlite3Static['vfs'];
  }

  interface Sqlite3CoreOo1Extensions {
    JsStorageDb: Sqlite3Static['oo1']['JsStorageDb'];
  }
}

export {};
