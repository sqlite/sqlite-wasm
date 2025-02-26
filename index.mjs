import { default as sqlite3InitModule } from './sqlite-wasm/jswasm/sqlite3-bundler-friendly.mjs';
import './sqlite-wasm/jswasm/sqlite3-worker1-promiser.mjs';

const sqlite3Worker1Promiser = globalThis.sqlite3Worker1Promiser;

export default sqlite3InitModule;
export { sqlite3Worker1Promiser };
