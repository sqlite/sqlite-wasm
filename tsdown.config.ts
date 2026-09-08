import { defineConfig, type UserConfig } from 'tsdown';
import { copyFileSync, rmSync } from 'node:fs';

const tsdownConfig: UserConfig[] = [
  defineConfig({
    target: 'es2023',
    entry: {
      index: 'src/browser.ts',
      core: 'src/browser-core.ts',
      node: 'src/node.ts',
      'bin/sqlite3-worker1': 'src/bin/sqlite3-worker1.mjs',
      vtab: 'src/vtab.ts',
      'vfs/kvvfs': 'src/vfs/kvvfs.ts',
      'vfs/opfs': 'src/vfs/opfs.ts',
      'vfs/opfs-sahpool': 'src/vfs/opfs-sahpool.ts',
      'vfs/opfs-wl': 'src/vfs/opfs-wl.ts',
    },
    format: ['esm'],
    dts: false,
    minify: 'dce-only',
    treeshake: {
      moduleSideEffects: (id) =>
        /\/src\/bin\/sqlite3-(?:vfs-|worker1-api)/.test(id.replaceAll('\\', '/')),
    },
    outputOptions: {
      comments: {
        legal: true,
      },
    },
    onSuccess: () => {
      copyFileSync('./src/bin/sqlite3.wasm', './dist/sqlite3.wasm');
      copyFileSync('./dist/bin/sqlite3-worker1.mjs', './dist/sqlite3-worker1.mjs');
    },
  }),
  defineConfig({
    target: 'es2023',
    entry: {
      'core.d': 'src/core.d.ts',
      'index.d': 'src/index.d.ts',
      'vtab.d': 'src/vtab.d.ts',
      'vfs/kvvfs.d': 'src/vfs/kvvfs.d.ts',
      'vfs/opfs.d': 'src/vfs/opfs.d.ts',
      'vfs/opfs-sahpool.d': 'src/vfs/opfs-sahpool.d.ts',
      'vfs/opfs-wl.d': 'src/vfs/opfs-wl.d.ts',
    },
    format: ['esm'],
    dts: true,
  }),
  defineConfig({
    target: 'es2023',
    entry: ['src/bin/sqlite3-opfs-async-proxy.js'],
    format: ['iife'],
    dts: false,
    minify: 'dce-only',
    outputOptions: {
      comments: {
        legal: true,
      },
    },
    onSuccess: () => {
      copyFileSync('./dist/sqlite3-opfs-async-proxy.iife.js', './dist/sqlite3-opfs-async-proxy.js');
      rmSync('./dist/sqlite3-opfs-async-proxy.iife.js');
      rmSync('./dist/bin', { recursive: true, force: true });
    },
  }),
];

export default tsdownConfig;
