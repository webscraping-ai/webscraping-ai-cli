#!/usr/bin/env tsx
/**
 * Hand-run smoke test that exercises every CLI subcommand against the live
 * API. Not part of the test suite — uses real credits (see
 * https://webscraping.ai/docs for pricing): the page commands and ask/extract
 * run with `--no-js --proxy datacenter` to keep the cost down, plus two
 * `serp` searches (one 1-page and one 2-page, billed per results page
 * returned) and one `data` call on a page on a site with a dedicated parser.
 * `account` and `serp-locations` are free. `data-any-site` runs
 * `data https://example.com/` (a site without a dedicated parser) and passes
 * on any of the API's documented outcomes: a success envelope
 * (`request_parameters` present), a 503 `structure_processing` when learning
 * the structure outlasts the request (exit 7, "(HTTP 503)" on stderr, not
 * charged), a 422 `structure_unavailable` (exit 7, "(HTTP 422)" on stderr,
 * not charged), or a 500 `timeout` when extracting the data or loading the
 * page runs out of time (exit 7, "(HTTP 500)" on stderr, not charged). The
 * CLI's stderr carries only the message and status, not the body's
 * `error_code`, so the error cases are matched on status. A success
 * envelope is charged.
 *
 * Usage:
 *   WEBSCRAPING_AI_API_KEY=... npm run smoke
 *
 * The script spawns the *built* CLI from `dist/cli.js` (run `npm run build`
 * first). Each case must exit 0 (or its `expectExit`; a signal-killed child
 * is a failure), write non-empty output when it expects 0, and pass its
 * `check` — so wrong results (e.g. an empty
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
  /** Expected exit code (default 0). Non-zero cases skip the non-empty-stdout check. */
  expectExit?: number;
  /** Accepted exit codes; overrides `expectExit` when set. Non-zero exits skip the non-empty-stdout check. */
  acceptExit?: number[];
  /** Return an error string if the output is wrong, or undefined if it's fine. */
  check?: (out: string, err: string) => string | undefined;
}

const target = 'https://example.com';
const serpQuery = 'coffee machines';
const dataUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
// Page commands: no JS + datacenter proxy, so each is billed at the
// documented minimum.
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
  {
    name: 'serp-location',
    args: ['serp', serpQuery, '--location', 'Austin, TX', '--pages', '2', '--no-pretty'],
    check: (out) => {
      const r = parseJson(out) as {
        organic_results?: unknown[];
        search_parameters?: { location_used?: unknown };
      };
      const used = r.search_parameters?.location_used;
      if (typeof used !== 'string' || !used.includes('Austin')) {
        return `search_parameters.location_used is ${JSON.stringify(used)}, expected it to contain "Austin"`;
      }
      if (!Array.isArray(r.organic_results) || r.organic_results.length === 0) {
        return 'organic_results is empty';
      }
      return undefined;
    },
  },
  {
    name: 'serp-locations',
    args: ['serp-locations', 'austin', '--limit', '3', '--no-pretty'],
    check: (out) => {
      const r = parseJson(out);
      if (!Array.isArray(r) || r.length === 0) return 'expected a non-empty JSON array';
      const name = (r[0] as { canonical_name?: unknown }).canonical_name;
      return typeof name === 'string' && name.includes('Austin')
        ? undefined
        : `first canonical_name is ${JSON.stringify(name)}, expected it to contain "Austin"`;
    },
  },
  {
    name: 'data',
    args: ['data', dataUrl, '--no-pretty'],
    check: (out) => {
      const r = parseJson(out) as {
        parse_status?: unknown;
        request_parameters?: { provider?: unknown };
        data?: { title?: unknown } | null;
      };
      if (r.parse_status !== 'ok') return `parse_status is ${JSON.stringify(r.parse_status)}`;
      if (r.request_parameters?.provider !== 'youtube') {
        return `request_parameters.provider is ${JSON.stringify(r.request_parameters?.provider)}`;
      }
      const title = r.data?.title;
      return typeof title === 'string' && title.trim() !== ''
        ? undefined
        : 'data is null or has no non-empty title';
    },
  },
  {
    name: 'data-any-site',
    args: ['data', 'https://example.com/', '--no-pretty'],
    // 0: success envelope on stdout;
    // 7: 503 structure_processing or 422 structure_unavailable (unmapped API errors),
    //    or 500 timeout (ServerError).
    acceptExit: [0, 7],
    check: (out, err) => {
      if (out.trim() === '') {
        return /\(HTTP (503|422|500)\)/.test(err)
          ? undefined
          : 'expected a 503 (structure_processing), 422 (structure_unavailable) or 500 (timeout) on stderr';
      }
      const r = parseJson(out) as { request_parameters?: unknown };
      if (r.request_parameters != null) return undefined;
      return `expected request_parameters, got ${out.slice(0, 120)}`;
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
    const accepted = c.acceptExit ?? [c.expectExit ?? 0];
    if (result.signal) problem = `killed by ${result.signal}`;
    else if (result.code === null || !accepted.includes(result.code)) {
      problem = `exit=${result.code}, expected ${accepted.join(' or ')}`;
    } else if (result.code === 0 && result.out.trim().length === 0) problem = 'empty output';
    else problem = c.check?.(result.out, result.err);
  } catch (e) {
    problem = `threw: ${e instanceof Error ? e.message : String(e)}`;
  }

  if (!problem && result) {
    const shown = result.code === 0 ? result.out : `exit=${result.code} ${result.err}`;
    console.log(`  ok   ${c.name.padEnd(18)}  ${redact(shown.slice(0, 120)).replace(/\n/g, ' ')}`);
  } else {
    failures += 1;
    const stderr = result ? ` stderr=${result.err.slice(0, 200)}` : '';
    console.log(redact(`  FAIL ${c.name.padEnd(18)}  ${problem}${stderr}`));
  }
}

process.exit(failures === 0 ? 0 : 1);
