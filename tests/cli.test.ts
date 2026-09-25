import { describe, expect, it } from 'vitest';

import { buildProgram } from '../src/cli.js';

describe('program structure', () => {
  const program = buildProgram();
  const names = program.commands.map((c) => c.name());

  it('registers all 9 endpoint commands', () => {
    for (const expected of [
      'html',
      'text',
      'selected',
      'selected-multiple',
      'ask',
      'extract',
      'serp',
      'data',
      'account',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('exposes serp under the `search` alias with SERP flags only', () => {
    const serp = program.commands.find((c) => c.name() === 'serp');
    expect(serp?.aliases()).toContain('search');
    const flags = serp?.options.map((o) => o.long) ?? [];
    for (const f of ['--engine', '--gl', '--hl', '--page']) expect(flags).toContain(f);
    for (const f of ['--js', '--proxy', '--country', '--headers']) expect(flags).not.toContain(f);
  });

  it('exposes data with its own flags only (no scrape flags)', () => {
    const data = program.commands.find((c) => c.name() === 'data');
    const flags = data?.options.map((o) => o.long) ?? [];
    for (const f of [
      '--country',
      '--transcript',
      '--transcript-language',
      '--param',
      '--output',
      '--pretty',
      '--no-pretty',
    ]) {
      expect(flags).toContain(f);
    }
    for (const f of ['--js', '--proxy', '--headers', '--timeout', '--device']) {
      expect(flags).not.toContain(f);
    }
  });

  it('registers auth and setup commands', () => {
    expect(names).toContain('auth');
    expect(names).toContain('setup');
  });

  it('exposes a --version flag', () => {
    const opts = program.options.map((o) => o.flags);
    expect(opts.some((f) => f.includes('--version'))).toBe(true);
  });
});

describe('exit codes', () => {
  it('maps SDK error subclasses to stable integer codes', async () => {
    const errors = await import('webscraping-ai');
    const { exitCodeFor } = await import('../src/lib/errors.js');

    expect(exitCodeFor(new errors.AuthenticationError({ message: 'x', status: 403 }))).toBe(4);
    expect(exitCodeFor(new errors.PaymentRequiredError({ message: 'x', status: 402 }))).toBe(5);
    expect(exitCodeFor(new errors.RateLimitError({ message: 'x', status: 429 }))).toBe(6);
    expect(exitCodeFor(new errors.APITimeoutError('x'))).toBe(8);
    expect(exitCodeFor(new errors.APIConnectionError('x'))).toBe(9);
  });
});
