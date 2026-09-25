import { CommanderError } from 'commander';
import type { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ConfigModule from '../src/lib/config.js';

const serpMock = vi.fn(async (o: unknown) => ({ echoed: o }));
const resolveApiKeyMock = vi.fn(async () => 'test-key');

vi.mock('../src/lib/sdk.js', () => ({
  createClient: () => ({ serp: serpMock }),
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

async function runSerp(args: string[]): Promise<unknown> {
  const cmd = command('serp');
  try {
    await cmd.parseAsync(args, { from: 'user' });
    return undefined;
  } catch (err) {
    return err;
  }
}

beforeEach(() => {
  serpMock.mockClear();
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
