import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { integerParser, parseFields, parseHeaders } from '../src/lib/options.js';

let workdir: string;

beforeAll(async () => {
  workdir = await fs.mkdtemp(join(tmpdir(), 'wsai-options-'));
});

afterAll(async () => {
  await fs.rm(workdir, { recursive: true, force: true });
});

describe('integerParser', () => {
  it('parses positive integers', () => {
    expect(integerParser('10000')).toBe(10000);
  });

  it('throws on non-integer input', () => {
    expect(() => integerParser('abc')).toThrow(/expected integer/);
  });
});

describe('parseHeaders', () => {
  it('returns undefined for empty input', async () => {
    expect(await parseHeaders('')).toBeUndefined();
    expect(await parseHeaders(undefined)).toBeUndefined();
  });

  it('parses inline JSON object', async () => {
    expect(await parseHeaders('{"Cookie":"session=abc"}')).toEqual({ Cookie: 'session=abc' });
  });

  it('reads JSON from @file', async () => {
    const path = join(workdir, 'headers.json');
    await fs.writeFile(path, '{"X-Test":"yes"}');
    expect(await parseHeaders(`@${path}`)).toEqual({ 'X-Test': 'yes' });
  });

  it('rejects arrays', async () => {
    await expect(parseHeaders('[1,2]')).rejects.toThrow(/object/);
  });

  it('rejects non-string values', async () => {
    await expect(parseHeaders('{"X":1}')).rejects.toThrow(/string/);
  });

  it('reports JSON parse errors with the field label', async () => {
    await expect(parseHeaders('{nope}')).rejects.toThrow(/headers: invalid JSON/);
  });
});

describe('parseFields', () => {
  it('parses inline JSON', async () => {
    const result = await parseFields('{"title":"Main title","price":"Cost"}');
    expect(result).toEqual({ title: 'Main title', price: 'Cost' });
  });

  it('reads JSON from @file', async () => {
    const path = join(workdir, 'fields.json');
    await fs.writeFile(path, '{"a":"description of a"}');
    expect(await parseFields(`@${path}`)).toEqual({ a: 'description of a' });
  });

  it('rejects empty objects', async () => {
    await expect(parseFields('{}')).rejects.toThrow(/non-empty/);
  });
});
