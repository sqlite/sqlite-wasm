import { defineConfig, type ViteUserConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

const browserIsolationHeaders = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

const vitestConfig: ViteUserConfig = defineConfig({
  plugins: [
    {
      name: 'configure-response-headers',
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          for (const [headerName, headerValue] of Object.entries(browserIsolationHeaders)) {
            res.setHeader(headerName, headerValue);
          }

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
          include: [
            'src/__tests__/sqlite3-node.test.js',
            'src/__tests__/bundler-compatibility.test.js',
          ],
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
            provider: playwright(),
            instances: [
              {
                browser: 'chromium',
                provider: playwright({
                  launchOptions: {
                    args: ['--enable-features=SharedArrayBuffer'],
                  },
                }),
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
