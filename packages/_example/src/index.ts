// Minimal example proving the toolchain works
// Explicit return type required for isolatedDeclarations
export function greet(name: string): string {
  return `Hello from godoo-ts, ${name}!`;
}

export const VERSION: string = '0.0.1';
