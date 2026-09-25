import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createEmitter, emit } from '../src/lib/output.js';
import { readQueriesFromStdin } from '../src/lib/stdin.js';

let workdir: string;

beforeAll(async () => {
  workdir = await fs.mkdtemp(join(tmpdir(), 'wsai-output-'));
});

afterAll(async () => {
  await fs.rm(workdir, { recursive: true, force: true });
});

describe('--output in batch mode', () => {
  it('truncates once, then appends every item', async () => {
    const file = join(workdir, 'batch.jsonl');
    await fs.writeFile(file, 'stale content from a previous run\n');

    const write = createEmitter({ output: file, pretty: false });
    await write({ n: 1 });
    await write({ n: 2 });
    await write('plain text');

    expect(await fs.readFile(file, 'utf8')).toBe('{"n":1}\n{"n":2}\nplain text\n');
  });

  it('plain emit still overwrites (single-result commands)', async () => {
    const file = join(workdir, 'single.json');
    await emit({ a: 1 }, { output: file, pretty: false });
    await emit({ a: 2 }, { output: file, pretty: false });
    expect(await fs.readFile(file, 'utf8')).toBe('{"a":2}\n');
  });
});

describe('readQueriesFromStdin', () => {
  it('skips only blank lines, keeping #hashtag queries verbatim', async () => {
    const input = Readable.from([
      '#coffee\n',
      '\n',
      '   \n',
      'coffee machines\r\n',
      '  espresso \n',
    ]);
    const out: string[] = [];
    for await (const q of readQueriesFromStdin(input)) out.push(q);
    expect(out).toEqual(['#coffee', 'coffee machines', '  espresso ']);
  });
});
