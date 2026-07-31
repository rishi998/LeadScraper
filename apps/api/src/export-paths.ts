import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

/** Monorepo root (…/scraper) whether cwd is root or apps/*. */
export function findMonorepoRoot(fromDir = process.cwd()): string {
  const candidates = [fromDir, resolve(fromDir, '..'), resolve(fromDir, '../..')];
  for (const dir of candidates) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
  }
  return resolve(fromDir, '../..');
}

/** Absolute export directory shared by worker (write) and API (download). */
export function resolveExportDir(fromDir = process.cwd()): string {
  const configured = process.env.EXPORT_DIR;
  if (configured && isAbsolute(configured)) return configured;
  const root = findMonorepoRoot(fromDir);
  if (configured) return resolve(root, configured);
  return resolve(root, 'exports');
}

/** Resolve a stored filePath (absolute or relative) to an existing file if possible. */
export function resolveExportFilePath(filePath: string, fromDir = process.cwd()): string | null {
  if (!filePath) return null;
  if (isAbsolute(filePath) && existsSync(filePath)) return filePath;

  const root = findMonorepoRoot(fromDir);
  const candidates = [
    filePath,
    resolve(process.cwd(), filePath),
    resolve(root, filePath),
    resolve(root, 'exports', filePath.replace(/^exports[/\\]/, '')),
    resolve(root, 'apps/worker/exports', filePath.replace(/^exports[/\\]/, '')),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}
