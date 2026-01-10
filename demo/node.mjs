import { readFileSync } from 'node:fs';
import sqlite3InitModule from '../src/node.js';

const log = (...args) => console.log(...args);
const error = (...args) => console.error(...args);

const start = function (sqlite3) {
  log('Running SQLite3 version', sqlite3.version.libVersion);

  const db = new sqlite3.oo1.DB(':memory:');

  try {
    log('Creating a table...');
    db.exec('CREATE TABLE IF NOT EXISTS t(a,b)');
    log('Insert some data using exec()...');
    for (let i = 20; i <= 25; ++i) {
      db.exec({
        sql: 'INSERT INTO t(a,b) VALUES (?,?)',
        bind: [i, i * 2],
      });
    }
    log('Query data with exec()...');
    db.exec({
      sql: 'SELECT a FROM t ORDER BY a LIMIT 3',
      callback: (row) => {
        log(row);
      },
    });
  } finally {
    db.close();
  }
};

// Mock fetch because Emscripten's Node.js loader still uses it and it fails on file:// URLs
globalThis.fetch = async (url) => {
  if (url.toString().endsWith('.wasm')) {
    const buffer = readFileSync(
      new URL('../dist/sqlite3.wasm', import.meta.url),
    );
    return new Response(buffer, {
      headers: { 'Content-Type': 'application/wasm' },
    });
  }
  throw new Error(`Unexpected fetch to ${url}`);
};

log('Loading and initializing SQLite3 module...');
sqlite3InitModule({
  print: log,
  printErr: error,
}).then((sqlite3) => {
  log('Done initializing. Running demo...');
  try {
    start(sqlite3);
  } catch (err) {
    error(err.name, err.message);
  }
});
