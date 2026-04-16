import { defineConfig, type UserConfig } from 'vite';

const viteConfig: UserConfig = defineConfig({
  server: {
    port: 5173,
  },
});

export default viteConfig;
