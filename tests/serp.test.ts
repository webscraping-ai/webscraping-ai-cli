import { CommanderError } from 'commander';
import type { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ConfigModule from '../src/lib/config.js';

const serpMock = vi.fn(async (o: unknown) => ({ echoed: o }));
const serpLocationsMock = vi.fn(async () => [
  { id: '1026201', canonical_name: 'Austin,Texas,United States', gps: [-97.7431, 30.2672] },
]);
const resolveApiKeyMock = vi.fn(async () => 'test-key');

vi.mock('../src/lib/sdk.js', () => ({
  createClient: () => ({ serp: serpMock, serpLocations: serpLocationsMock }),
}));
vi.mock('../src/lib/config.js', async (importOriginal) => ({
  ...(await importOriginal<typeof ConfigModule>()),
  resolveApiKey: () => resolveApiKeyMock(),
}));

const { buildProgram } = await import('../src/cli.js');
const { EXIT_CODES } = await import('../src/lib/errors.js');

function command(name: string): Command {
  const cmd = buildProgram().commands.find((c) => c.name() === name);
  if (!cmd) throw new Error(`no ${name} command`);
  cmd.exitOverride();
  cmd.configureOutput({ writeErr: () => {}, writeOut: () => {} });
  return cmd;
}

/** Parse flags only: swap the action for a no-op and return the parsed opts. */
async function parseOpts(name: string, args: string[]): Promise<Record<string, unknown>> {
  const cmd = command(name);
  cmd.action(() => {});
  await cmd.parseAsync(args, { from: 'user' });
  return cmd.opts();
}

async function run(name: string, args: string[]): Promise<unknown> {
  const cmd = command(name);
  try {
    await cmd.parseAsync(args, { from: 'user' });
    return undefined;
  } catch (err) {
    return err;
  }
}

const runSerp = (args: string[]): Promise<unknown> => run('serp', args);

/** Run with stdout captured; returns the error (if any) and what was written. */
async function runCaptured(name: string, args: string[]): Promise<{ err: unknown; out: string }> {
  let out = '';
  const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    out += String(chunk);
    return true;
  });
  try {
    return { err: await run(name, args), out };
  } finally {
    write.mockRestore();
  }
}

beforeEach(() => {
  serpMock.mockClear();
  serpLocationsMock.mockClear();
  resolveApiKeyMock.mockClear();
});

describe('--pretty / --no-pretty', () => {
  for (const [name, positional] of [
    ['serp', 'coffee'],
    ['html', 'https://example.com'],
  ] as const) {
    it(`${name}: --pretty sets pretty=true`, async () => {
      expect((await parseOpts(name, [positional, '--pretty'])).pretty).toBe(true);
    });

    it(`${name}: --no-pretty sets pretty=false`, async () => {
      expect((await parseOpts(name, [positional, '--no-pretty'])).pretty).toBe(false);
    });

    it(`${name}: neither flag leaves pretty undefined (TTY default applies)`, async () => {
      expect((await parseOpts(name, [positional])).pretty).toBeUndefined();
    });
  }
});

describe('serp --page validation', () => {
  for (const bad of ['1.5', '2abc', '0', '-1', '01', '', '1e3', '99999999999999999999']) {
    it(`rejects --page ${JSON.stringify(bad)} with the usage exit code before resolving the key`, async () => {
      const err = await runSerp(['-', '--page', bad]);
      expect(err).toBeInstanceOf(CommanderError);
      expect((err as CommanderError).exitCode).toBe(EXIT_CODES.usage);
      expect((err as CommanderError).code).toBe('wsai.invalidPage');
      expect(resolveApiKeyMock).not.toHaveBeenCalled();
      expect(serpMock).not.toHaveBeenCalled();
    });
  }

  it('passes a valid --page through as a number', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      expect(await runSerp(['coffee', 'machines', '--page', '3'])).toBeUndefined();
    } finally {
      write.mockRestore();
    }
    expect(serpMock).toHaveBeenCalledWith({ q: 'coffee machines', page: 3 });
  });

  it('rejects a whitespace-only query with the usage exit code', async () => {
    const err = await runSerp(['   ']);
    expect((err as CommanderError).exitCode).toBe(EXIT_CODES.usage);
    expect(resolveApiKeyMock).not.toHaveBeenCalled();
  });
});

describe('serp --pages and location flags', () => {
  it('passes --pages, --location and --radius through', async () => {
    const { err } = await runCaptured('serp', [
      'coffee',
      'machines',
      '--pages',
      '2',
      '--location',
      'Austin, TX',
      '--radius',
      '500',
    ]);
    expect(err).toBeUndefined();
    expect(serpMock).toHaveBeenCalledWith({
      q: 'coffee machines',
      pages: 2,
      location: 'Austin, TX',
      radius: 500,
    });
  });

  it('passes --uule through as given', async () => {
    const { err } = await runCaptured('serp', ['coffee', '--uule', 'w+CAIQICIGQXVzdGlu']);
    expect(err).toBeUndefined();
    expect(serpMock).toHaveBeenCalledWith({ q: 'coffee', uule: 'w+CAIQICIGQXVzdGlu' });
  });

  it('reads negative --lat/--lon values instead of treating them as flags', async () => {
    const { err } = await runCaptured('serp', ['coffee', '--lat', '-33.86', '--lon', '-151.2093']);
    expect(err).toBeUndefined();
    expect(serpMock).toHaveBeenCalledWith({ q: 'coffee', lat: -33.86, lon: -151.2093 });
  });

  it('accepts the --lat=-33.86 form too', async () => {
    const { err } = await runCaptured('serp', ['coffee', '--lat=-33.86', '--lon=151']);
    expect(err).toBeUndefined();
    expect(serpMock).toHaveBeenCalledWith({ q: 'coffee', lat: -33.86, lon: 151 });
  });

  const bad: Array<[string, string, string]> = [
    ['--pages', '0', 'wsai.invalidPages'],
    ['--pages', '1.5', 'wsai.invalidPages'],
    ['--pages', '2x', 'wsai.invalidPages'],
    ['--radius', '-5', 'wsai.invalidRadius'],
    ['--radius', '10.5', 'wsai.invalidRadius'],
    ['--lat', 'abc', 'wsai.invalidLat'],
    ['--lat', '', 'wsai.invalidLat'],
    ['--lat', '1e3', 'wsai.invalidLat'],
    ['--lon', 'Infinity', 'wsai.invalidLon'],
    ['--lon', '12,5', 'wsai.invalidLon'],
  ];
  for (const [flag, value, code] of bad) {
    it(`rejects ${flag} ${JSON.stringify(value)} with the usage exit code before resolving the key`, async () => {
      const err = await runSerp(['-', flag, value]);
      expect(err).toBeInstanceOf(CommanderError);
      expect((err as CommanderError).exitCode).toBe(EXIT_CODES.usage);
      expect((err as CommanderError).code).toBe(code);
      expect(resolveApiKeyMock).not.toHaveBeenCalled();
      expect(serpMock).not.toHaveBeenCalled();
    });
  }
});

describe('serp-locations', () => {
  it('joins the query words, passes --limit and prints the JSON array', async () => {
    const { err, out } = await runCaptured('serp-locations', [
      'new',
      'york',
      '--limit',
      '3',
      '--no-pretty',
    ]);
    expect(err).toBeUndefined();
    expect(serpLocationsMock).toHaveBeenCalledWith({ q: 'new york', limit: 3 });
    expect(out).toBe(
      '[{"id":"1026201","canonical_name":"Austin,Texas,United States","gps":[-97.7431,30.2672]}]\n',
    );
  });

  it('pretty-prints with --pretty', async () => {
    const { out } = await runCaptured('serp-locations', ['austin', '--pretty']);
    expect(out).toContain('\n  {\n    "id": "1026201"');
  });

  it('sends no q without a query', async () => {
    const { err } = await runCaptured('serp-locations', []);
    expect(err).toBeUndefined();
    expect(serpLocationsMock).toHaveBeenCalledWith({});
  });

  it('rejects a lone `-` (no stdin mode) with the usage exit code before resolving the key', async () => {
    const err = await run('serp-locations', ['-']);
    expect(err).toBeInstanceOf(CommanderError);
    expect((err as CommanderError).exitCode).toBe(EXIT_CODES.usage);
    expect((err as CommanderError).code).toBe('wsai.stdinUnsupported');
    expect(resolveApiKeyMock).not.toHaveBeenCalled();
    expect(serpLocationsMock).not.toHaveBeenCalled();
  });

  for (const bad of ['0', '-1', '2.5', 'ten', '']) {
    it(`rejects --limit ${JSON.stringify(bad)} with the usage exit code before resolving the key`, async () => {
      const err = await run('serp-locations', ['austin', '--limit', bad]);
      expect(err).toBeInstanceOf(CommanderError);
      expect((err as CommanderError).exitCode).toBe(EXIT_CODES.usage);
      expect((err as CommanderError).code).toBe('wsai.invalidLimit');
      expect(resolveApiKeyMock).not.toHaveBeenCalled();
      expect(serpLocationsMock).not.toHaveBeenCalled();
    });
  }
});
