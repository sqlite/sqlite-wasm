import type sqlite3InitModuleDeclaration from './';
import type { sqlite3Worker1Promiser as sqlite3Worker1PromiserDeclaration } from './';
import './vfs/kvvfs';
import './vfs/opfs';
import './vfs/opfs-sahpool';
import './vfs/opfs-wl';
import './bin/sqlite3-worker1-api.mjs';
import './vtab';

// @ts-expect-error Generated runtime bundle has no declaration file.
import sqlite3InitModuleRuntime from './bin/sqlite3-bundler-friendly.core.mjs';
// @ts-expect-error Generated runtime bundle has no declaration file.
import sqlite3Worker1PromiserRuntime from './bin/sqlite3-worker1-promiser.mjs';

/** @deprecated Sqlite3Worker1Promiser is deprecated as of 2026-04-15. */
export const sqlite3Worker1Promiser =
  sqlite3Worker1PromiserRuntime as typeof sqlite3Worker1PromiserDeclaration;

const sqlite3InitModule = sqlite3InitModuleRuntime as typeof sqlite3InitModuleDeclaration;

export default sqlite3InitModule;
