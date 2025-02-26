#!/usr/bin/env node
import fs from 'fs';
import fetch from 'node-fetch';
import decompress from 'decompress';

async function getSqliteWasmDownloadLink() {
  const response = await fetch('https://sqlite.org/download.html');
  const html = await response.text();
  const sqliteWasmLink =
    'https://sqlite.org/' +
    html
      .replace(
        /^.*?<!-- Download product data for scripts to read(.*?)-->.*?$/gms,
        '$1',
      )
      .split(/\n/)
      .filter((row) => /sqlite-wasm/.test(row))[0]
      .split(/,/)[2];
  console.log(`Found SQLite Wasm download link: ${sqliteWasmLink}`);
  return sqliteWasmLink;
}

async function downloadAndUnzipSqliteWasm(sqliteWasmDownloadLink) {
  if (!sqliteWasmDownloadLink) {
    throw new Error('Unable to find SQLite Wasm download link');
  }
  console.log('Downloading and unzipping SQLite Wasm...');
  const response = await fetch(sqliteWasmDownloadLink);
  if (!response.ok || response.status !== 200) {
    throw new Error(
      `Unable to download SQLite Wasm from ${sqliteWasmDownloadLink}`,
    );
  }
  const buffer = await response.arrayBuffer();
  fs.writeFileSync('sqlite-wasm.zip', Buffer.from(buffer));
  const files = await decompress('sqlite-wasm.zip', 'sqlite-wasm', {
    strip: 1,
    filter: (file) =>
      /jswasm/.test(file.path) && /(\.mjs|\.wasm|\.js)$/.test(file.path),
  });
  console.log(
    `Downloaded and unzipped:\n${files
      .map((file) => (/\//.test(file.path) ? '‣ ' + file.path + '\n' : ''))
      .join('')}`,
  );
  fs.rmSync('sqlite-wasm.zip');
}

async function main() {
  try {
    const sqliteWasmLink = await getSqliteWasmDownloadLink();
    await downloadAndUnzipSqliteWasm(sqliteWasmLink);
    fs.copyFileSync(
      './node_modules/module-workers-polyfill/module-workers-polyfill.min.js',
      './demo/module-workers-polyfill.min.js',
    );
  } catch (err) {
    console.error(err.name, err.message);
  }
}

main();
