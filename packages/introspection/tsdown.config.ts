import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts', './src/cli/cli.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  platform: 'node',
});
