import { dirname, resolve } from 'node:path';
import { defineConfig } from 'tsdown';

const sharedModules = new Map(
  Object.entries({
    'src/types/errors': '../errors.mjs',
    'src/safety': '../safety.mjs',
    'src/safety/index': '../safety.mjs',
    'src/services/properties/binding-validation': '../binding-validation.mjs',
    'src/services/modules/errors': '../module-errors.mjs',
  }).map(([source, output]) => [resolve(source), output]),
);

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
        const shared = sharedModules.get(target);
        if (shared) return { id: shared, external: true };
      },
    },
  ],
});
