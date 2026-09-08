import type { Sqlite3Static } from '../index.js';

declare module '@sqlite.org/sqlite-wasm/core' {
  interface Sqlite3CoreExtensions {
    installOpfsSAHPoolVfs: Sqlite3Static['installOpfsSAHPoolVfs'];
    vfs: Sqlite3Static['vfs'];
  }
}

export {};
