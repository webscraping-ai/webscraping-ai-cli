/**
 * Output handling for command results.
 *
 * All command handlers funnel through `emit()`. The result type drives format:
 *   - strings → written verbatim
 *   - objects/arrays → JSON.stringified (pretty by default; `--pretty` is the
 *     default for terminals, single-line for pipes/redirects)
 *
 * `--output FILE` writes to disk instead of stdout.
 */

import { promises as fs } from 'node:fs';

export interface EmitOptions {
  output?: string;
  pretty?: boolean;
}

export async function emit(value: unknown, opts: EmitOptions = {}): Promise<void> {
  const text = stringify(value, opts);

  if (opts.output && opts.output.trim() !== '') {
    await fs.writeFile(opts.output, text + (text.endsWith('\n') ? '' : '\n'));
    return;
  }

  process.stdout.write(text);
  if (!text.endsWith('\n')) process.stdout.write('\n');
}

export function stringify(value: unknown, opts: EmitOptions = {}): string {
  if (typeof value === 'string') return value;

  const pretty = opts.pretty ?? process.stdout.isTTY ?? false;
  return JSON.stringify(value, null, pretty ? 2 : 0);
}
