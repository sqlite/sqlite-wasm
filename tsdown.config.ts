import { defineConfig, type UserConfig } from 'tsdown';
import { copyFileSync, rmSync } from 'node:fs';

const tsdownConfig: UserConfig[] = [
  defineConfig({
    target: 'es2023',
    entry: {
      index: 'src/browser.ts',
      node: 'src/node.ts',
      'bin/sqlite3-worker1': 'src/bin/sqlite3-worker1.mjs',
    },
    format: ['esm'],
    dts: false,
    minify: 'dce-only',
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
      'index.d': 'src/index.d.ts',
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
