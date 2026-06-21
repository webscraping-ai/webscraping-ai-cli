/**
 * API key resolution and persisted config.
 *
 * Resolution order (first non-empty wins):
 *   1. `--api-key` flag                  (handled by the caller, passed in)
 *   2. `WEBSCRAPING_AI_API_KEY` env var
 *   3. `~/.config/webscraping-ai/config.json` (or `$XDG_CONFIG_HOME/...`)
 *
 * The config file is plain JSON with `{ "apiKey": "..." }`. We chmod it to
 * 0600 so it's not world-readable.
 */

import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const CONFIG_FILENAME = 'config.json';

export function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg && xdg.trim() !== '') return join(xdg, 'webscraping-ai');
  return join(homedir(), '.config', 'webscraping-ai');
}

export function configPath(): string {
  return join(configDir(), CONFIG_FILENAME);
}

export interface PersistedConfig {
  apiKey?: string;
}

export async function readPersistedConfig(): Promise<PersistedConfig> {
  try {
    const text = await fs.readFile(configPath(), 'utf8');
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as PersistedConfig;
    }
    return {};
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
}

export async function writePersistedConfig(config: PersistedConfig): Promise<void> {
  const path = configPath();
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  // `mode` above only applies when the file is freshly created; an existing
  // file keeps its old (possibly world-readable) perms. Enforce 0600
  // unconditionally — chmod on a just-written file is cheap and idempotent.
  // No-op on Windows, but harmless.
  await fs.chmod(path, 0o600);
}

export async function clearPersistedConfig(): Promise<boolean> {
  try {
    await fs.unlink(configPath());
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}

export interface ResolveApiKeyOptions {
  /** `--api-key` flag value, if the user passed one. */
  flag?: string;
}

export async function resolveApiKey(opts: ResolveApiKeyOptions = {}): Promise<string> {
  if (opts.flag && opts.flag.trim() !== '') return opts.flag.trim();

  const env = process.env.WEBSCRAPING_AI_API_KEY;
  if (env && env.trim() !== '') return env.trim();

  const persisted = await readPersistedConfig();
  if (persisted.apiKey && persisted.apiKey.trim() !== '') return persisted.apiKey.trim();

  throw new Error(
    'No API key found. Set $WEBSCRAPING_AI_API_KEY, pass --api-key, or run `webscraping-ai auth set <key>`.',
  );
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return '*'.repeat(key.length);
  return `${key.slice(0, 4)}${'*'.repeat(key.length - 8)}${key.slice(-4)}`;
}
