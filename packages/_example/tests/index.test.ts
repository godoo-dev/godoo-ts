import { describe, expect, it } from 'vitest';
import { greet, VERSION } from '../src/index.js';

describe('greet', () => {
  it('returns greeting with name', () => {
    expect(greet('world')).toBe('Hello from godoo-ts, world!');
  });
});

describe('VERSION', () => {
  it('is a string', () => {
    expect(typeof VERSION).toBe('string');
  });
});
