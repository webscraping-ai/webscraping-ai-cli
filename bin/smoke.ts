#!/usr/bin/env tsx
/**
 * Hand-run smoke test that exercises every CLI subcommand against the live
 * API. Not part of the test suite — costs ~31 credits per full sweep: the
 * page commands run with `--no-js --proxy datacenter`, so html/text/selected/
 * selected-multiple are 1 credit each (4), ask/extract 6 each (12), and
 * `serp` a flat 15. `account` is free.
 *
 * Usage:
 *   WEBSCRAPING_AI_API_KEY=... npm run smoke
 *
 * The script spawns the *built* CLI from `dist/cli.js` (run `npm run build`
 * first). Each case must exit 0 (a signal-killed child is a failure), write
 * non-empty output, and pass its `check` — so wrong results (e.g. an empty
 * SERP or `[[]]` from selected-multiple) fail, not just crashes. FAIL lines
 * never print the API key.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const apiKey = process.env.WEBSCRAPING_AI_API_KEY;
if (!apiKey) {
  console.error('WEBSCRAPING_AI_API_KEY env var is required');
  process.exit(2);
}

const cliPath = resolve(import.meta.dirname ?? '.', '..', 'dist', 'cli.js');
if (!existsSync(cliPath)) {
  console.error(`Built CLI not found at ${cliPath} — run \`npm run build\` first.`);
  process.exit(2);
}

interface Case {
  name: string;
  args: string[];
  /** Return an error string if the output is wrong, or undefined if it's fine. */
  check?: (out: string) => string | undefined;
}

const target = 'https://example.com';
const serpQuery = 'coffee machines';
// Page commands: no JS + datacenter proxy, so each is billed at 1 credit
// (6 for ask/extract) and the ~31-credit sweep estimate holds.
const cheap = ['--no-js', '--proxy', 'datacenter'];

function parseJson(out: string): unknown {
  return JSON.parse(out);
}

const cases: Case[] = [
  { name: 'account', args: ['account'] },
  { name: 'html', args: ['html', target, ...cheap] },
  {
    name: 'serp',
    args: ['serp', serpQuery, '--no-pretty'],
    check: (out) => {
      const r = parseJson(out) as {
        organic_results?: unknown[];
        search_parameters?: { q?: unknown };
      };
      if (!Array.isArray(r.organic_results) || r.organic_results.length === 0) {
        return 'organic_results is empty';
      }
      if (r.search_parameters?.q !== serpQuery) {
        return `search_parameters.q is ${JSON.stringify(r.search_parameters?.q)}, expected ${JSON.stringify(serpQuery)}`;
      }
      return undefined;
    },
  },
  { name: 'text', args: ['text', target, ...cheap] },
  { name: 'selected', args: ['selected', target, '--selector', 'h1', ...cheap] },
  {
    name: 'selected-multiple',
    args: [
      'selected-multiple',
      target,
      '--selector',
      'h1',
      '--selector',
      'p',
      '--no-pretty',
      ...cheap,
    ],
    check: (out) => {
      const r = parseJson(out);
      if (!Array.isArray(r)) return 'expected a JSON array';
      const anyNonEmpty = r.some((inner) => Array.isArray(inner) && inner.length > 0);
      return anyNonEmpty ? undefined : `every inner array is empty: ${out.trim().slice(0, 80)}`;
    },
  },
  {
    name: 'ask',
    args: ['ask', target, '-q', 'What is this page about? Answer in one sentence.', ...cheap],
  },
  {
    name: 'extract',
    args: [
      'extract',
      target,
      '--fields',
      '{"title":"Page title","description":"Short description"}',
      '--no-pretty',
      ...cheap,
    ],
    check: (out) => {
      const r = parseJson(out);
      return r && typeof r === 'object' && !Array.isArray(r) ? undefined : 'expected a JSON object';
    },
  },
];

/** Strip the API key (raw or URL-encoded) and any `api_key=...` from text. */
function redact(text: string): string {
  let out = text.replace(/(api_key=)[^&\s"'<>]*/gi, '$1[REDACTED]');
  for (const form of new Set([apiKey as string, encodeURIComponent(apiKey as string)])) {
    out = out.split(form).join('[REDACTED]');
  }
  return out;
}

interface RunResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  out: string;
  err: string;
}

function run(args: string[]): Promise<RunResult> {
  return new Promise((resolveP) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      env: { ...process.env, WEBSCRAPING_AI_API_KEY: apiKey },
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString()));
    child.on('error', (e) => resolveP({ code: null, signal: null, out, err: err + String(e) }));
    child.on('close', (code, signal) => resolveP({ code, signal, out, err }));
  });
}

let failures = 0;
for (const c of cases) {
  let problem: string | undefined;
  let result: RunResult | undefined;
  try {
    result = await run(c.args);
    if (result.signal) problem = `killed by ${result.signal}`;
    else if (result.code !== 0) problem = `exit=${result.code}`;
    else if (result.out.trim().length === 0) problem = 'empty output';
    else problem = c.check?.(result.out);
  } catch (e) {
    problem = `threw: ${e instanceof Error ? e.message : String(e)}`;
  }

  if (!problem && result) {
    console.log(
      `  ok   ${c.name.padEnd(18)}  ${redact(result.out.slice(0, 120)).replace(/\n/g, ' ')}`,
    );
  } else {
    failures += 1;
    const stderr = result ? ` stderr=${result.err.slice(0, 200)}` : '';
    console.log(redact(`  FAIL ${c.name.padEnd(18)}  ${problem}${stderr}`));
  }
}

process.exit(failures === 0 ? 0 : 1);
