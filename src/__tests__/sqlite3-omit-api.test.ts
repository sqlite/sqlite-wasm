import { describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import packageJson from '../../package.json' with { type: 'json' };

type InitModule = (moduleArg?: { wasmBinary?: Uint8Array }) => Promise<Record<string, any>>;

type OmitApiVariant = {
  name: string;
  sourcePath: string;
  exportPath: string;
  distPath: string;
  expected: {
    vtab: boolean;
    kvvfs: boolean;
    opfsDb: boolean;
    opfsWlDb: boolean;
    sahPool: boolean;
  };
};

const variants: OmitApiVariant[] = [
  {
    name: 'core',
    sourcePath: '../bin/sqlite3-core-bundler-friendly.mjs',
    exportPath: './bundler/core',
    distPath: './dist/sqlite3-core-bundler-friendly.mjs',
    expected: { vtab: false, kvvfs: false, opfsDb: false, opfsWlDb: false, sahPool: false },
  },
  {
    name: 'vtab',
    sourcePath: '../bin/sqlite3-core-vtab-bundler-friendly.mjs',
    exportPath: './bundler/vtab',
    distPath: './dist/sqlite3-core-vtab-bundler-friendly.mjs',
    expected: { vtab: true, kvvfs: false, opfsDb: false, opfsWlDb: false, sahPool: false },
  },
  {
    name: 'kvvfs',
    sourcePath: '../bin/sqlite3-core-kvvfs-bundler-friendly.mjs',
    exportPath: './bundler/kvvfs',
    distPath: './dist/sqlite3-core-kvvfs-bundler-friendly.mjs',
    expected: { vtab: false, kvvfs: true, opfsDb: false, opfsWlDb: false, sahPool: false },
  },
  {
    name: 'opfs',
    sourcePath: '../bin/sqlite3-core-opfs-bundler-friendly.mjs',
    exportPath: './bundler/opfs',
    distPath: './dist/sqlite3-core-opfs-bundler-friendly.mjs',
    expected: { vtab: false, kvvfs: false, opfsDb: false, opfsWlDb: false, sahPool: false },
  },
  {
    name: 'opfs-wl',
    sourcePath: '../bin/sqlite3-core-opfs-wl-bundler-friendly.mjs',
    exportPath: './bundler/opfs-wl',
    distPath: './dist/sqlite3-core-opfs-wl-bundler-friendly.mjs',
    expected: { vtab: false, kvvfs: false, opfsDb: false, opfsWlDb: false, sahPool: false },
  },
  {
    name: 'sah-pool',
    sourcePath: '../bin/sqlite3-core-opfs-sahpool-bundler-friendly.mjs',
    exportPath: './bundler/sah-pool',
    distPath: './dist/sqlite3-core-opfs-sahpool-bundler-friendly.mjs',
    expected: { vtab: false, kvvfs: false, opfsDb: false, opfsWlDb: false, sahPool: true },
  },
];

const wasmBinary = readFileSync(new URL('../bin/sqlite3.wasm', import.meta.url));

describe('omit-api generated scripts', () => {
  test.each(variants)('$name exposes the expected API surface in Node', async (variant) => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const module = (await import(new URL(variant.sourcePath, import.meta.url).href)) as {
        default: InitModule;
      };
      const sqlite3 = await module.default({ wasmBinary });
      const db = new sqlite3.oo1.DB(':memory:');

      try {
        db.exec('CREATE TABLE t(value); INSERT INTO t(value) VALUES (42)');
        expect(db.selectValue('SELECT value FROM t')).toBe(42);
      } finally {
        db.close();
      }

      expect(sqlite3.version.libVersion).toBe('3.53.4');
      expect('initWorker1API' in sqlite3).toBe(false);
      expect(sqlite3.Worker1Promiser).toBeUndefined();
      expect(
        (globalThis as { sqlite3Worker1Promiser?: unknown }).sqlite3Worker1Promiser,
      ).toBeUndefined();
      expect(Boolean(sqlite3.vfs)).toBe(true);
      expect(Boolean(sqlite3.vtab)).toBe(variant.expected.vtab);
      expect(Boolean(sqlite3.kvvfs)).toBe(variant.expected.kvvfs);
      expect(Boolean(sqlite3.oo1.OpfsDb)).toBe(variant.expected.opfsDb);
      expect(Boolean(sqlite3.oo1.OpfsWlDb)).toBe(variant.expected.opfsWlDb);
      expect(Boolean(sqlite3.installOpfsSAHPoolVfs)).toBe(variant.expected.sahPool);
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('package exports point to the fixed omit-api dist files', () => {
    const exports = packageJson.exports as Record<string, string | Record<string, string>>;

    for (const variant of variants) {
      expect(exports[variant.exportPath]).toMatchObject({
        import: variant.distPath,
        default: variant.distPath,
      });
    }

    expect(exports['./bundler']).toBeUndefined();
  });
});
