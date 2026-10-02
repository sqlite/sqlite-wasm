import coreInitModule from '../../bundler/core.js';
import kvvfsInitModule from '../../bundler/kvvfs.js';
import opfsInitModule from '../../bundler/opfs.js';
import opfsWlInitModule from '../../bundler/opfs-wl.js';
import sahPoolInitModule from '../../bundler/sah-pool.js';
import vtabInitModule from '../../bundler/vtab.js';

const checkCore = async () => {
  const sqlite3 = await coreInitModule();
  new sqlite3.oo1.DB(':memory:');
  // @ts-expect-error core build omits vtab helpers.
  sqlite3.vtab;
  // @ts-expect-error core build omits kvvfs helpers.
  sqlite3.kvvfs;
  // @ts-expect-error core build omits OPFS.
  sqlite3.oo1.OpfsDb;
  // @ts-expect-error core build omits OPFS WebLocks.
  sqlite3.oo1.OpfsWlDb;
  // @ts-expect-error core build omits OPFS SAH Pool.
  sqlite3.installOpfsSAHPoolVfs;
};

const checkVtab = async () => {
  const sqlite3 = await vtabInitModule();
  sqlite3.vtab.xVtab;
  // @ts-expect-error vtab build omits kvvfs helpers.
  sqlite3.kvvfs;
  // @ts-expect-error vtab build omits OPFS.
  sqlite3.oo1.OpfsDb;
};

const checkKvvfs = async () => {
  const sqlite3 = await kvvfsInitModule();
  sqlite3.kvvfs.unlink('db');
  new sqlite3.oo1.JsStorageDb('session');
  // @ts-expect-error kvvfs build omits vtab helpers.
  sqlite3.vtab;
  // @ts-expect-error kvvfs build omits OPFS.
  sqlite3.oo1.OpfsDb;
};

const checkOpfs = async () => {
  const sqlite3 = await opfsInitModule();
  new sqlite3.oo1.OpfsDb('/app.sqlite3', 'ct');
  // @ts-expect-error OPFS build omits OPFS WebLocks.
  sqlite3.oo1.OpfsWlDb;
  // @ts-expect-error OPFS build omits OPFS SAH Pool.
  sqlite3.installOpfsSAHPoolVfs;
};

const checkOpfsWl = async () => {
  const sqlite3 = await opfsWlInitModule();
  new sqlite3.oo1.OpfsWlDb('/app.sqlite3', 'ct');
  // @ts-expect-error OPFS WebLocks build omits OPFS.
  sqlite3.oo1.OpfsDb;
  // @ts-expect-error OPFS WebLocks build omits OPFS SAH Pool.
  sqlite3.installOpfsSAHPoolVfs;
};

const checkSahPool = async () => {
  const sqlite3 = await sahPoolInitModule();
  const sahPool = await sqlite3.installOpfsSAHPoolVfs({});
  new sahPool.OpfsSAHPoolDb('/app.sqlite3');
  // @ts-expect-error OPFS SAH Pool build omits OPFS.
  sqlite3.oo1.OpfsDb;
  // @ts-expect-error OPFS SAH Pool build omits OPFS WebLocks.
  sqlite3.oo1.OpfsWlDb;
};

void checkCore;
void checkVtab;
void checkKvvfs;
void checkOpfs;
void checkOpfsWl;
void checkSahPool;
