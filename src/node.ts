import type sqlite3InitModuleDeclaration from './index.js';

// @ts-expect-error Generated runtime bundle has no declaration file.
import sqlite3InitModuleRuntime from './bin/sqlite3-node.mjs';

const sqlite3InitModule = sqlite3InitModuleRuntime as typeof sqlite3InitModuleDeclaration;

export default sqlite3InitModule;
