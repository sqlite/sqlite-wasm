import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  entry: './src/main.js',
  output: {
    filename: 'bundle.js',
    path: resolve(__dirname, 'dist'),
    clean: true,
  },
  stats: {
    errorDetails: true,
  },
  devtool: 'source-map',
  experiments: {
    asyncWebAssembly: true,
  },
  devServer: {
    port: 5173,
    static: {
      directory: __dirname,
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
};
