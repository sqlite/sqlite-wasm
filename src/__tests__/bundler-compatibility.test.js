import { describe, test, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

describe('Vite bundler compatibility', () => {
  test('should rename sqlite3.wasm with a hash and update the import URL', () => {
    const testDir = path.resolve(__dirname, 'vite-repro');
    const distDir = path.resolve(testDir, 'dist');

    // Clean up previous build
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }

    // Run vite build
    execSync('npx vite build', { cwd: testDir, stdio: 'inherit' });

    // 1. Check if hashed WASM file exists in dist/assets
    const assetsDir = path.resolve(distDir, 'assets');
    const files = fs.readdirSync(assetsDir);
    const wasmFile = files.find(
      (f) => f.startsWith('sqlite3-') && f.endsWith('.wasm'),
    );

    expect(wasmFile).toBeDefined();

    // 2. Check if the JS bundle contains the hashed WASM filename
    const assetsDirJs = path.resolve(distDir, 'assets');
    const jsFiles = fs
      .readdirSync(assetsDirJs)
      .filter((f) => f.endsWith('.js'));
    const mainBundle = jsFiles.find((f) => f.startsWith('index-'));
    expect(mainBundle).toBeDefined();

    const bundleContent = fs.readFileSync(
      path.resolve(assetsDirJs, mainBundle),
      'utf8',
    );

    // It should contain something like: new URL("/assets/sqlite3-hash.wasm", import.meta.url)
    expect(bundleContent).toContain(wasmFile);

    // Specifically check that it's part of a new URL call or at least correctly referenced
    const urlPattern = new RegExp(
      `new URL\\(".*${wasmFile}",\\s*import\\.meta\\.url\\)`,
    );
    expect(bundleContent).toMatch(urlPattern);
  });
});
