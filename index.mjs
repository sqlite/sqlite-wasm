import { default as sqlite3InitModule } from './sqlite-wasm/jswasm/sqlite3-bundler-friendly.mjs';
import { default as sqlite3InitModuleNode } from './sqlite-wasm/jswasm/sqlite3-node.mjs';

export default sqlite3InitModule;
export { sqlite3InitModuleNode };
