import { defineConfig, type UserConfig } from 'vite';

const viteConfig: UserConfig = defineConfig({
  server: {
    port: 5175,
  },
});

export default viteConfig;
