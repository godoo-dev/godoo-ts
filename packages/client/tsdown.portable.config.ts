import { dirname, resolve } from 'node:path';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: './src/portable.ts' },
  outDir: './dist/portable',
  format: 'esm',
  fixedExtension: true,
  dts: true,
  clean: true,
  platform: 'browser',
  // Resolve and include debug's browser backend so importing this package in a
  // worker never follows debug's Node entrypoint to util, tty or process.
  deps: { alwaysBundle: ['debug', 'ms'], onlyBundle: ['debug', 'ms'] },
  plugins: [
    {
      name: 'shared-portable-errors-and-safety',
      resolveId(source, importer) {
        if (!importer || !source.startsWith('.')) return;
        const target = resolve(dirname(importer), source).replace(/\.(?:d\.)?[cm]?ts$/, '');
        if (target === resolve('src/types/errors')) {
          return { id: '../errors.mjs', external: true };
        }
        if (target === resolve('src/safety') || target === resolve('src/safety/index')) {
          return { id: '../safety.mjs', external: true };
        }
        if (target === resolve('src/services/properties/binding-validation')) {
          return { id: '../binding-validation.mjs', external: true };
        }
        if (target === resolve('src/services/modules/errors')) {
          return { id: '../module-errors.mjs', external: true };
        }
      },
    },
  ],
});
