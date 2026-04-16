import { defineConfig, type UserConfig } from 'vite';

const viteConfig: UserConfig = defineConfig({
  server: {
    port: 5174,
  },
});

export default viteConfig;
