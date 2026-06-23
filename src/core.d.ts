import type { Sqlite3Static } from './index.js';

type CoreOo1 = Omit<Sqlite3Static['oo1'], 'JsStorageDb' | 'OpfsDb' | 'OpfsWlDb'>;

export interface Sqlite3CoreExtensions {}

export interface Sqlite3CoreOo1Extensions {}

export type Sqlite3CoreStatic = Omit<
  Sqlite3Static,
  'Worker1Promiser' | 'initWorker1API' | 'installOpfsSAHPoolVfs' | 'kvvfs' | 'vfs' | 'vtab' | 'oo1'
> & {
  oo1: CoreOo1 & Sqlite3CoreOo1Extensions;
} & Sqlite3CoreExtensions;

/**
 * Loads SQLite without optional JS initializers such as VFS helpers, vtab
 * helpers, kvvfs, OPFS VFSes, SAHPool, or Worker API #1.
 */
export default function init(): Promise<Sqlite3CoreStatic>;
