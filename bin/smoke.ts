#!/usr/bin/env tsx
/**
 * Hand-run smoke test that exercises every CLI subcommand against the live
 * API. Not part of the test suite — costs ~17 credits per full sweep.
 *
 * Usage:
 *   WEBSCRAPING_AI_API_KEY=... npm run smoke
 *
 * The script spawns the *built* CLI from `dist/cli.js` (run `npm run build`
 * first) and asserts each command exits 0 and writes non-empty output.
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
}

const target = 'https://example.com';
const cases: Case[] = [
  { name: 'account', args: ['account'] },
  { name: 'html', args: ['html', target, '--no-js'] },
  { name: 'text', args: ['text', target, '--no-js'] },
  { name: 'selected', args: ['selected', target, '--selector', 'h1', '--no-js'] },
  {
    name: 'selected-multiple',
    args: ['selected-multiple', target, '--selector', 'h1', '--selector', 'p', '--no-js'],
  },
  {
    name: 'ask',
    args: [
      'ask',
      target,
      '-q',
      'What is this page about? Answer in one sentence.',
      '--no-js',
    ],
  },
  {
    name: 'extract',
    args: [
      'extract',
      target,
      '--fields',
      '{"title":"Page title","description":"Short description"}',
      '--no-js',
    ],
  },
];

function run(args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolveP) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      env: { ...process.env, WEBSCRAPING_AI_API_KEY: apiKey },
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString()));
    child.on('close', (code) => resolveP({ code: code ?? 0, out, err }));
  });
}

let failures = 0;
for (const c of cases) {
  const result = await run(c.args);
  if (result.code === 0 && result.out.trim().length > 0) {
    console.log(`  ok   ${c.name.padEnd(18)}  ${result.out.slice(0, 120).replace(/\n/g, ' ')}`);
  } else {
    failures += 1;
    console.log(
      `  FAIL ${c.name.padEnd(18)}  exit=${result.code} stderr=${result.err.slice(0, 200)}`,
    );
  }
}

process.exit(failures === 0 ? 0 : 1);
