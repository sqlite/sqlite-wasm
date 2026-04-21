import { defineConfig, type OxfmtConfig } from 'oxfmt';

const oxfmtConfig: OxfmtConfig = defineConfig({
  printWidth: 100,
  proseWrap: 'always',
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  ignorePatterns: ['/src/bin', '/dist', '/node_modules', 'package.json'],
});

export default oxfmtConfig;
