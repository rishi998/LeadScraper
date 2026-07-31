import dns from 'node:dns';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Windows/Node often fails mongodb+srv SRV lookups (querySrv ECONNREFUSED)
 * when the system DNS/IPv6 path is broken. Prefer public DNS + IPv4.
 */
export function prepareMongoDns(): void {
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {
    /* Node < 17 */
  }
  try {
    // Avoid local resolvers (e.g. 127.0.0.1) that refuse mongodb+srv SRV lookups on Windows.
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  } catch {
    /* ignore */
  }
}

/** Load monorepo root `.env` (does not override existing process.env). */
export function loadRootEnv(fromDir = process.cwd()): string | null {
  prepareMongoDns();

  const candidates = [
    resolve(fromDir, '.env'),
    resolve(fromDir, '../.env'),
    resolve(fromDir, '../../.env'),
  ];

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
    return file;
  }
  return null;
}
