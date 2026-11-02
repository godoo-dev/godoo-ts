import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: './src/index.ts',
    effects: './src/effects.ts',
    reference: './src/reference.ts',
    errors: './src/types/errors.ts',
    safety: './src/safety/index.ts',
    'binding-validation': './src/services/properties/binding-validation.ts',
    'module-errors': './src/services/modules/errors.ts',
  },
  format: 'esm',
  dts: true,
  clean: true,
  platform: 'node',
});
