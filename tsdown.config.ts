import { defineConfig, type UserConfig } from 'tsdown';
import { copyFileSync, rmSync } from 'node:fs';

const tsdownConfig: UserConfig[] = [
  defineConfig({
    target: 'es2023',
    entry: [
      'src/index.js',
      'src/node.js',
      'src/index.d.ts',
      'src/bin/sqlite3-worker1.mjs',
    ],
    format: ['esm'],
    minify: 'dce-only',
    outputOptions: {
      legalComments: 'inline',
    },
    onSuccess: () => {
      copyFileSync('./src/bin/sqlite3.wasm', './dist/sqlite3.wasm');
      copyFileSync(
        './dist/bin/sqlite3-worker1.mjs',
        './dist/sqlite3-worker1.mjs',
      );
    },
  }),
  defineConfig({
    target: 'es2023',
    entry: ['src/bin/sqlite3-opfs-async-proxy.js'],
    format: ['iife'],
    minify: 'dce-only',
    outputOptions: {
      legalComments: 'inline',
    },
    onSuccess: () => {
      copyFileSync(
        './dist/sqlite3-opfs-async-proxy.iife.js',
        './dist/sqlite3-opfs-async-proxy.js',
      );
      rmSync('./dist/sqlite3-opfs-async-proxy.iife.js');
      rmSync('./dist/bin', { recursive: true, force: true });
    },
  }),
];

export default tsdownConfig;
