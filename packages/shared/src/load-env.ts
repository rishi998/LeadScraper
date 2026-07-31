import dns from 'node:dns';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function prepareMongoDns(): void {
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {
    /* Node < 17 */
  }
  try {
    const current = dns.getServers();
    dns.setServers(['8.8.8.8', '1.1.1.1', ...current.filter((s) => s !== '8.8.8.8' && s !== '1.1.1.1')]);
  } catch {
    /* ignore */
  }
}

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
      if (process.env[key] === undefined) process.env[key] = value;
    }
    return file;
  }
  return null;
}
