import { defineConfig, type TsdownPlugin, type UserConfig } from 'tsdown';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const omitApiEntries = {
  'sqlite3-core-bundler-friendly': 'src/bin/sqlite3-core-bundler-friendly.mjs',
  'sqlite3-core-vtab-bundler-friendly': 'src/bin/sqlite3-core-vtab-bundler-friendly.mjs',
  'sqlite3-core-kvvfs-bundler-friendly': 'src/bin/sqlite3-core-kvvfs-bundler-friendly.mjs',
  'sqlite3-core-opfs-bundler-friendly': 'src/bin/sqlite3-core-opfs-bundler-friendly.mjs',
  'sqlite3-core-opfs-wl-bundler-friendly': 'src/bin/sqlite3-core-opfs-wl-bundler-friendly.mjs',
  'sqlite3-core-opfs-sahpool-bundler-friendly':
    'src/bin/sqlite3-core-opfs-sahpool-bundler-friendly.mjs',
};

const isChunk = (item: { type: string }): item is { type: 'chunk'; code: string } =>
  item.type === 'chunk';

const copyRuntimeArtifactsPlugin: TsdownPlugin = {
  name: 'sqlite-wasm:copy-runtime-artifacts',
  writeBundle: (_options, bundle) => {
    copyFileSync('./src/bin/sqlite3.wasm', './dist/sqlite3.wasm');
    const worker1 = bundle['bin/sqlite3-worker1.mjs'];
    if (worker1 && isChunk(worker1)) {
      writeFileSync('./dist/sqlite3-worker1.mjs', worker1.code);
    }
    mkdirSync('./dist/bundler', { recursive: true });
    for (const name of ['shared', 'core', 'vtab', 'kvvfs', 'opfs', 'opfs-wl', 'sah-pool']) {
      const declaration = readFileSync(`./src/bundler/${name}.d.ts`, 'utf8')
        .replaceAll("from '../index.js'", "from '../index.d.mts'")
        .replaceAll("from './shared.js'", "from './shared.d.mts'");
      writeFileSync(`./dist/bundler/${name}.d.mts`, declaration);
    }
  },
};

const finalizeIifeArtifactsPlugin: TsdownPlugin = {
  name: 'sqlite-wasm:finalize-iife-artifacts',
  writeBundle: (_options, bundle) => {
    const proxy = bundle['sqlite3-opfs-async-proxy.iife.js'];
    if (proxy && isChunk(proxy)) {
      writeFileSync('./dist/sqlite3-opfs-async-proxy.js', proxy.code);
    }
    rmSync('./dist/sqlite3-opfs-async-proxy.iife.js', { force: true });
    rmSync('./dist/bin', { recursive: true, force: true });
  },
};

const tsdownConfig: UserConfig[] = [
  defineConfig({
    target: 'es2023',
    entry: {
      index: 'src/browser.ts',
      node: 'src/node.ts',
      'bin/sqlite3-worker1': 'src/bin/sqlite3-worker1.mjs',
      ...omitApiEntries,
    },
    format: ['esm'],
    dts: false,
    minify: 'dce-only',
    plugins: [copyRuntimeArtifactsPlugin],
    publint: true,
    attw: {
      profile: 'esm-only',
      level: 'error',
      excludeEntrypoints: ['./sqlite3.wasm'],
    },
    outputOptions: {
      comments: {
        legal: true,
      },
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
    plugins: [finalizeIifeArtifactsPlugin],
    outputOptions: {
      comments: {
        legal: true,
      },
    },
  }),
];

export default tsdownConfig;
