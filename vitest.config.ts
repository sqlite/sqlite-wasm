import { defineConfig, type ViteUserConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

const vitestConfig: ViteUserConfig = defineConfig({
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  plugins: [
    {
      name: 'configure-response-headers',
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          next();
        });
      },
    },
  ],
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/__tests__/sqlite3-node.test.js'],
        },
      },
      {
        test: {
          name: 'browser',
          include: ['src/__tests__/*.browser.test.js'],
          browser: {
            enabled: true,
            headless: true,
            screenshotFailures: false,
            provider: playwright({
              launchOptions: {
                args: ['--enable-features=SharedArrayBuffer'],
              },
            }),
            instances: [
              {
                browser: 'chromium',
              },
            ],
          },
        },
      },
    ],
    watch: false,
  },
});

export default vitestConfig;
