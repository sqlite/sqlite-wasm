import { defineConfig, type UserConfig } from 'tsdown';
import { copyFileSync, rmSync, readFileSync, writeFileSync } from 'node:fs';

const tsdownConfig: UserConfig = defineConfig({
  target: 'es2023',
  entry: [
    'src/index.js',
    'src/node.js',
    'src/index.d.ts',
    'src/bin/sqlite3-opfs-async-proxy.js',
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
    // Remove "export {};" to make sure sqlite3-opfs-async-proxy.js isn't a module
    const proxyContent = readFileSync(
      './dist/bin/sqlite3-opfs-async-proxy.mjs',
      'utf-8',
    );
    writeFileSync(
      './dist/sqlite3-opfs-async-proxy.js',
      proxyContent.replace(/export\s*\{\s*}\s*;\s*$/, ''),
    );
    rmSync('./dist/bin', { recursive: true });
  },
});

export default tsdownConfig;
