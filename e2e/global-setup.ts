import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export default function globalSetup(): void {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  execFileSync('node', [resolve(root, 'scripts', 'gen-e2e-fixtures.mjs')], {
    stdio: 'inherit',
  });
}
