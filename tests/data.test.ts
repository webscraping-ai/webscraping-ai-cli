import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { CommanderError } from 'commander';
import type { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ConfigModule from '../src/lib/config.js';

const dataMock = vi.fn(async (o: { url: string }) => ({ echoed: o }));
const resolveApiKeyMock = vi.fn(async () => 'test-key');

vi.mock('../src/lib/sdk.js', () => ({
  createClient: () => ({ data: dataMock }),
}));
vi.mock('../src/lib/config.js', async (importOriginal) => ({
  ...(await importOriginal<typeof ConfigModule>()),
  resolveApiKey: () => resolveApiKeyMock(),
}));

const { buildProgram } = await import('../src/cli.js');
const { EXIT_CODES } = await import('../src/lib/errors.js');

function command(): Command {
  const cmd = buildProgram().commands.find((c) => c.name() === 'data');
  if (!cmd) throw new Error('no data command');
  cmd.exitOverride();
  cmd.configureOutput({ writeErr: () => {}, writeOut: () => {} });
  return cmd;
}

async function runData(args: string[]): Promise<unknown> {
  const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  try {
    await command().parseAsync(args, { from: 'user' });
    return undefined;
  } catch (err) {
    return err;
  } finally {
    write.mockRestore();
  }
}

beforeEach(() => {
  dataMock.mockClear();
  resolveApiKeyMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('data command', () => {
  it('maps flags to SDK options', async () => {
    const err = await runData([
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      '--country',
      'gb',
      '--transcript',
      '--transcript-language',
      'de',
      '--param',
      'comments=20',
      '--param',
      'sort=top',
    ]);
    expect(err).toBeUndefined();
    expect(dataMock).toHaveBeenCalledWith({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      country: 'gb',
      transcript: true,
      transcript_language: 'de',
      params: { comments: '20', sort: 'top' },
    });
  });

  it('sends a hostile unknown-site URL unmodified (no client-side site check)', async () => {
    const hostile = '  https://Example.COM/A%2Fb/ünï?x=1&y=a b#Frag  ';
    expect(await runData([hostile])).toBeUndefined();
    expect(dataMock).toHaveBeenCalledWith({ url: hostile });
  });

  it('rejects a whitespace-only url with the usage exit code before resolving the key', async () => {
    const err = await runData(['   ']);
    expect(err).toBeInstanceOf(CommanderError);
    expect((err as CommanderError).exitCode).toBe(EXIT_CODES.usage);
    expect((err as CommanderError).code).toBe('wsai.emptyUrl');
    expect(resolveApiKeyMock).not.toHaveBeenCalled();
    expect(dataMock).not.toHaveBeenCalled();
  });

  for (const bad of [
    'api_key=evil',
    'url=https://x',
    'from_cli=false',
    '__proto__=x',
    'country=de',
    'transcript=true',
    'transcript_language=en',
    'novalue',
    '=x',
  ]) {
    it(`rejects --param ${bad} with the usage exit code before resolving the key`, async () => {
      const err = await runData(['https://example.com/', '--param', bad]);
      expect((err as CommanderError).exitCode).toBe(EXIT_CODES.usage);
      expect((err as CommanderError).code).toBe('wsai.invalidParam');
      expect(resolveApiKeyMock).not.toHaveBeenCalled();
      expect(dataMock).not.toHaveBeenCalled();
    });
  }

  it('rejects a repeated --param key with the usage exit code', async () => {
    const err = await runData(['https://example.com/', '--param', 'a=1', '--param', 'a=2']);
    expect((err as CommanderError).exitCode).toBe(EXIT_CODES.usage);
    expect((err as CommanderError).message).toMatch(/"a" given more than once/);
    expect(dataMock).not.toHaveBeenCalled();
  });

  it('points --param country=x at --country', async () => {
    const err = await runData(['https://example.com/', '--param', 'country=x']);
    expect((err as CommanderError).exitCode).toBe(EXIT_CODES.usage);
    expect((err as CommanderError).message).toMatch(/use --country/);
  });

  it('stdin batch: truncates -o up front, so empty stdin leaves an empty file', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'wsai-data-'));
    const out = join(dir, 'out.jsonl');
    await fs.writeFile(out, 'stale\n');
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(
      Readable.from([]) as unknown as typeof process.stdin,
    );

    expect(await runData(['-', '-o', out])).toBeUndefined();
    expect(await fs.readFile(out, 'utf8')).toBe('');
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('stdin batch: stops at the first error; -o holds no stale content', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'wsai-data-'));
    const out = join(dir, 'out.jsonl');
    await fs.writeFile(out, 'stale\n');
    dataMock.mockRejectedValueOnce(new Error('boom'));
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(
      Readable.from(['https://a.test/\n', 'https://b.test/\n']) as unknown as typeof process.stdin,
    );

    const err = await runData(['-', '-o', out]);
    expect((err as Error).message).toBe('boom');
    expect(dataMock).toHaveBeenCalledTimes(1);
    expect(await fs.readFile(out, 'utf8')).toBe('');
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('reads URLs from stdin with `-`, skipping blank and # lines, appending to -o', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'wsai-data-'));
    const out = join(dir, 'out.jsonl');
    const stdin = Readable.from([
      'https://www.youtube.com/watch?v=a\n',
      '\n# comment\n',
      'https://www.tiktok.com/@nasa\n',
    ]);
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(stdin as unknown as typeof process.stdin);

    expect(await runData(['-', '--no-pretty', '-o', out])).toBeUndefined();
    expect(dataMock.mock.calls.map(([o]) => o.url)).toEqual([
      'https://www.youtube.com/watch?v=a',
      'https://www.tiktok.com/@nasa',
    ]);
    const lines = (await fs.readFile(out, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1]!)).toEqual({ echoed: { url: 'https://www.tiktok.com/@nasa' } });
    await fs.rm(dir, { recursive: true, force: true });
  });
});
