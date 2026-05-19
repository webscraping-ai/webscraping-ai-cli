/**
 * Stdin batching helpers.
 *
 * When a URL argument is `-`, the command reads one URL per line from stdin
 * and runs the operation for each. Empty lines and lines starting with `#`
 * are skipped so users can comment URL lists.
 */

import readline from 'node:readline';

export function urlIsStdin(url: string): boolean {
  return url === '-';
}

export async function* readUrlsFromStdin(): AsyncIterable<string> {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const raw of rl) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    yield line;
  }
}

/**
 * Iterate URLs from either a single CLI arg or from stdin (if the arg is `-`).
 */
export async function* urlIterator(arg: string): AsyncIterable<string> {
  if (urlIsStdin(arg)) {
    yield* readUrlsFromStdin();
    return;
  }
  yield arg;
}
