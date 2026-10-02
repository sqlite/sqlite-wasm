# Bundler vtab omit-api build

Use this when you need the virtual table helper APIs and do not need any bundled VFS implementation.

```ts
// Main thread or worker
import sqlite3InitModule from '@sqlite.org/sqlite-wasm/bundler/vtab';

const sqlite3 = await sqlite3InitModule();

console.log(sqlite3.vtab); // virtual table helper namespace
```

This build includes the core runtime and vtab helpers. It omits Worker1, kvvfs, OPFS, OPFS WebLocks,
and OPFS SAH Pool.
