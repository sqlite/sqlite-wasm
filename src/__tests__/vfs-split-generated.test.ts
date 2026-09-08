import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

const readGenerated = (name: string): string => readFileSync(`src/bin/${name}`, 'utf8');

test('split generator keeps optional initializers out of the core runtime', () => {
  const core = readGenerated('sqlite3-bundler-friendly.core.mjs');

  expect(core).toContain('sqlite3BundlerFriendlyOptionalState');
  expect(core).not.toContain('This file implements the initializer for SQLite\'s "Worker API #1"');
  expect(core).not.toContain('This file installs sqlite3.vfs, a namespace of helpers');
  expect(core).not.toContain('This file installs sqlite3.vtab, a namespace of helpers');
  expect(core).not.toContain('This file houses the "kvvfs" pieces of the SQLite3 JS API');
  expect(core).not.toContain('This file holds code shared by sqlite3-vfs-opfs{,-wl}.c-pp.js');
  expect(core).not.toContain('This file holds a sqlite3_vfs backed by OPFS storage');
  expect(core).not.toContain('This file is a reimplementation of the "opfs" VFS');
});

test('split optional modules register initializer blocks without requiring bootstrap at import time', () => {
  const worker1 = readGenerated('sqlite3-worker1-api.mjs');
  const vtab = readGenerated('sqlite3-vfs-vtab.mjs');
  const kvvfs = readGenerated('sqlite3-vfs-kvvfs.mjs');
  const opfs = readGenerated('sqlite3-vfs-opfs.mjs');

  expect(worker1).toContain(
    "sqlite3BundlerFriendlyRegisterOptionalInitializer('worker1', function(sqlite3)",
  );
  expect(vtab).toContain(
    "sqlite3BundlerFriendlyRegisterOptionalInitializer('vtab', function(sqlite3)",
  );
  expect(kvvfs).toContain(
    "sqlite3BundlerFriendlyRegisterOptionalInitializer('kvvfs', function(sqlite3)",
  );
  expect(kvvfs).not.toContain('globalThis.sqlite3ApiBootstrap.initializers.push(function(sqlite3)');
  expect(opfs).toContain(
    "sqlite3BundlerFriendlyRegisterOptionalInitializer('opfs', function(sqlite3)",
  );
  expect(opfs).toContain('globalThis.sqlite3ApiBootstrap.initializersAsync.push');
});
