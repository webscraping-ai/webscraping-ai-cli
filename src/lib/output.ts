/**
 * Output handling for command results.
 *
 * All command handlers funnel through `emit()`. The result type drives format:
 *   - strings → written verbatim
 *   - objects/arrays → JSON.stringified (pretty by default; `--pretty` is the
 *     default for terminals, single-line for pipes/redirects)
 *
 * `--output FILE` writes to disk instead of stdout. Commands use
 * `openEmitter()`: in stdin batch mode (`-`) it truncates the file up front
 * (so a first-item failure or empty stdin never leaves stale content) and
 * appends every result, so each item survives instead of overwriting the last.
 */

import { promises as fs } from 'node:fs';

import { urlIsStdin } from './stdin.js';

export interface EmitOptions {
  output?: string;
  pretty?: boolean;
}

export interface EmitWriteOptions {
  /** Append to `--output` instead of truncating it (batch items after the first). */
  append?: boolean;
}

export async function emit(
  value: unknown,
  opts: EmitOptions = {},
  write: EmitWriteOptions = {},
): Promise<void> {
  const text = stringify(value, opts);

  if (opts.output && opts.output.trim() !== '') {
    const data = text + (text.endsWith('\n') ? '' : '\n');
    if (write.append) await fs.appendFile(opts.output, data);
    else await fs.writeFile(opts.output, data);
    return;
  }

  process.stdout.write(text);
  if (!text.endsWith('\n')) process.stdout.write('\n');
}

/**
 * Returns an `emit` bound to `opts` for a (possibly batched) loop: the first
 * call truncates `--output`, later calls append.
 */
export function createEmitter(opts: EmitOptions = {}): (value: unknown) => Promise<void> {
  let first = true;
  return async (value: unknown) => {
    const append = !first;
    first = false;
    await emit(value, opts, { append });
  };
}

export function stringify(value: unknown, opts: EmitOptions = {}): string {
  if (typeof value === 'string') return value;

  const pretty = opts.pretty ?? process.stdout.isTTY ?? false;
  return JSON.stringify(value, null, pretty ? 2 : 0);
}

/**
 * Emitter for a command whose positional arg is `arg`. When `arg` is `-`
 * (stdin batch) and `--output` is set, the file is truncated now, before any
 * request, and every result is appended. Otherwise same as `createEmitter()`.
 */
export async function openEmitter(
  opts: EmitOptions,
  arg: string,
): Promise<(value: unknown) => Promise<void>> {
  if (urlIsStdin(arg) && opts.output && opts.output.trim() !== '') {
    await fs.writeFile(opts.output, '');
    return (value: unknown) => emit(value, opts, { append: true });
  }
  return createEmitter(opts);
}
