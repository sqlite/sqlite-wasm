import { defineConfig, type UserConfig } from 'tsdown';
import { copyFileSync } from 'node:fs';

const tsdownConfig: UserConfig = defineConfig({
  target: 'es2023',
  entry: ['src/index.js', 'src/node.js', 'src/index.d.ts'],
  format: ['esm'],
  minify: 'dce-only',
  outputOptions: {
    legalComments: 'none',
  },
  onSuccess: () => {
    copyFileSync('./src/bin/sqlite3.wasm', './dist/sqlite3.wasm');
  },
});

export default tsdownConfig;
