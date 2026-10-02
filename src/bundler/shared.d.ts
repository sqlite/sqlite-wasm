import type { Sqlite3Static } from '../index.js';

type Worker1Keys = 'initWorker1API' | 'Worker1Promiser';
type OptionalFeatureKeys = 'installOpfsSAHPoolVfs' | 'kvvfs' | 'vtab';
type CoreOo1 = Pick<Sqlite3Static['oo1'], 'DB'>;

type BaseBundlerSqlite3Static = Omit<Sqlite3Static, Worker1Keys | OptionalFeatureKeys | 'oo1'> & {
  oo1: CoreOo1;
};

type WithOo1<K extends keyof Sqlite3Static['oo1']> = Omit<BaseBundlerSqlite3Static, 'oo1'> & {
  oo1: CoreOo1 & Pick<Sqlite3Static['oo1'], K>;
};

export type CoreSqlite3Static = BaseBundlerSqlite3Static;

export type VtabSqlite3Static = BaseBundlerSqlite3Static & Pick<Sqlite3Static, 'vtab'>;

export type KvvfsSqlite3Static = Omit<BaseBundlerSqlite3Static, 'oo1'> &
  Pick<Sqlite3Static, 'kvvfs'> & {
    oo1: CoreOo1 & Pick<Sqlite3Static['oo1'], 'JsStorageDb'>;
  };

export type OpfsSqlite3Static = WithOo1<'OpfsDb'>;

export type OpfsWlSqlite3Static = WithOo1<'OpfsWlDb'>;

export type SahPoolSqlite3Static = BaseBundlerSqlite3Static &
  Pick<Sqlite3Static, 'installOpfsSAHPoolVfs'>;
