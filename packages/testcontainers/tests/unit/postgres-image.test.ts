import { describe, expect, it } from 'vitest';
import { parseFromImage, postgresImage } from '../../src/postgres-image.js';

describe('postgres image', () => {
  it('reads the shipped Dockerfile', () => {
    expect(postgresImage()).toMatch(/^postgres:\d+/);
  });

  it('accepts platform flags, digests and stage names', () => {
    expect(
      parseFromImage('# pinned\nFROM --platform=linux/amd64 postgres:16-alpine@sha256:ab AS db\n'),
    ).toBe('postgres:16-alpine@sha256:ab');
  });

  it('rejects a file without FROM', () => {
    expect(() => parseFromImage('# empty\n')).toThrow('no FROM image');
  });
});
