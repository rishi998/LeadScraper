import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

export function findMonorepoRoot(fromDir = process.cwd()): string {
  const candidates = [fromDir, resolve(fromDir, '..'), resolve(fromDir, '../..')];
  for (const dir of candidates) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
  }
  return resolve(fromDir, '../..');
}

export function resolveExportDir(fromDir = process.cwd()): string {
  const configured = process.env.EXPORT_DIR;
  if (configured && isAbsolute(configured)) return configured;
  const root = findMonorepoRoot(fromDir);
  if (configured) return resolve(root, configured);
  return resolve(root, 'exports');
}
