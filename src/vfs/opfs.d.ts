import type { Sqlite3Static } from '../index.js';

declare module '@sqlite.org/sqlite-wasm/core' {
  interface Sqlite3CoreExtensions {
    vfs: Sqlite3Static['vfs'];
  }

  interface Sqlite3CoreOo1Extensions {
    OpfsDb: Sqlite3Static['oo1']['OpfsDb'];
  }
}

export {};
