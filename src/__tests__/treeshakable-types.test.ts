import { describe, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const runTypeCheck = (source: string): void => {
  const dir = mkdtempSync(path.join(process.cwd(), '.tmp-treeshakable-types-'));
  const file = path.join(dir, 'fixture.ts');
  const tsconfig = path.join(dir, 'tsconfig.json');

  try {
    writeFileSync(file, source);
    writeFileSync(
      tsconfig,
      JSON.stringify(
        {
          compilerOptions: {
            noEmit: true,
            module: 'esnext',
            target: 'es2023',
            moduleResolution: 'bundler',
            strict: true,
            skipLibCheck: true,
            lib: ['esnext', 'dom'],
            paths: {
              '@sqlite.org/sqlite-wasm': ['../src/index.d.ts'],
              '@sqlite.org/sqlite-wasm/core': ['../src/core.d.ts'],
              '@sqlite.org/sqlite-wasm/vtab': ['../src/vtab.d.ts'],
              '@sqlite.org/sqlite-wasm/vfs/kvvfs': ['../src/vfs/kvvfs.d.ts'],
              '@sqlite.org/sqlite-wasm/vfs/opfs': ['../src/vfs/opfs.d.ts'],
              '@sqlite.org/sqlite-wasm/vfs/opfs-sahpool': ['../src/vfs/opfs-sahpool.d.ts'],
              '@sqlite.org/sqlite-wasm/vfs/opfs-wl': ['../src/vfs/opfs-wl.d.ts'],
            },
          },
          include: [file],
        },
        null,
        2,
      ),
    );
    execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--project', tsconfig], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('treeshakable entry types', () => {
  test('core types omit optional APIs', () => {
    runTypeCheck(`
      import init from '@sqlite.org/sqlite-wasm/core';

      async function checkCore() {
        const sqlite3 = await init();
        sqlite3.oo1.DB;
        // @ts-expect-error core does not include kvvfs
        sqlite3.kvvfs;
        // @ts-expect-error core does not include vtab helpers
        sqlite3.vtab;
        // @ts-expect-error core does not include Worker API #1
        sqlite3.initWorker1API;
        // @ts-expect-error core does not include OPFS DB constructor
        sqlite3.oo1.OpfsDb;
      }
    `);
  });

  test('vfs imports augment core types only with their installed APIs', () => {
    runTypeCheck(`
      import '@sqlite.org/sqlite-wasm/vfs/kvvfs';
      import init from '@sqlite.org/sqlite-wasm/core';

      async function checkKvvfs() {
        const sqlite3 = await init();
        sqlite3.kvvfs.unlink('x');
        sqlite3.vfs.installVfs;
        sqlite3.oo1.JsStorageDb;
        // @ts-expect-error kvvfs import does not include OPFS DB constructor
        sqlite3.oo1.OpfsDb;
        // @ts-expect-error kvvfs import does not include Worker API #1
        sqlite3.initWorker1API;
      }
    `);
  });
});
