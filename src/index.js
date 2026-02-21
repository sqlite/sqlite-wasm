import { default as sqlite3InitModule } from './bin/sqlite3-bundler-friendly.mjs';
import { default as sqlite3Worker1Promiser } from './bin/sqlite3-worker1-promiser.mjs';

/** @type {import('./index.d.ts').Worker1PromiserFactory} */
const typedWorker1Promiser = sqlite3Worker1Promiser;

export default sqlite3InitModule;

export { typedWorker1Promiser as sqlite3Worker1Promiser };
