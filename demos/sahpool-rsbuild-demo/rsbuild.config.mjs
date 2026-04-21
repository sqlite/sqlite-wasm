import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  html: {
    title: 'SAHPOOL Rsbuild Demo',
  },
});
