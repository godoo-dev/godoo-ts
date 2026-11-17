import { readFileSync } from 'node:fs';

const DOCKERFILE = new URL('../postgres.Dockerfile', import.meta.url);

/** Return the image of the first `FROM` line, ignoring `--platform=` and `AS name`. */
export function parseFromImage(dockerfile: string): string {
  for (const line of dockerfile.split('\n')) {
    const words = line.trim().split(/\s+/);
    if (words[0]?.toUpperCase() !== 'FROM') continue;
    const image = words.slice(1).find((word) => !word.startsWith('--'));
    if (image) return image;
  }
  throw new Error('postgres.Dockerfile has no FROM image');
}

/** The Postgres image pinned in the package's `postgres.Dockerfile`, which Dependabot updates. */
export function postgresImage(): string {
  return parseFromImage(readFileSync(DOCKERFILE, 'utf8'));
}
