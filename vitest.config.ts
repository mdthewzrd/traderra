import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest config for traderra.
 *
 * traderra previously had `scripts.test = "vitest"` + the dependency installed,
 * but no config and no tests — so `npm test` would fall back to vitest defaults
 * and drag in the vendored, self-contained reference project under engine/docs
 * (which imports packages absent here and does not compile). This minimal config
 * scopes test discovery to src/, wires the `@` -> ./src path alias Next.js uses
 * throughout the codebase, and excludes vendored/build artifacts.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'],
    exclude: ['node_modules/**', 'engine/**', '.next/**', 'dist/**'],
  },
});
