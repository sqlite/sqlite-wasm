import type { Sqlite3Static } from './index.js';

declare module '@sqlite.org/sqlite-wasm/core' {
  interface Sqlite3CoreExtensions {
    vtab: Sqlite3Static['vtab'];
  }
}

export {};
