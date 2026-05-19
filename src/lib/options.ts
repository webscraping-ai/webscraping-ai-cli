/**
 * Shared commander options and the parsers/expanders behind them.
 *
 * All scrape endpoints share the same nine "common" flags. We define them in
 * one place and apply via `addCommonScrapeOptions(cmd)` so the surface stays
 * consistent and any change lands everywhere at once.
 */

import { promises as fs } from 'node:fs';
import { Option } from 'commander';
import type { Command } from 'commander';

export interface CommonRawFlags {
  apiKey?: string;
  output?: string;
  format?: 'text' | 'json';
  pretty?: boolean;
  js?: boolean;
  proxy?: 'datacenter' | 'residential' | 'stealth';
  country?: string;
  device?: 'desktop' | 'mobile' | 'tablet';
  timeout?: number;
  jsTimeout?: number;
  waitFor?: string;
  headers?: string;
  jsScript?: string;
  customProxy?: string;
  errorOn404?: boolean;
  errorOnRedirect?: boolean;
}

/**
 * Add the flags every scrape-endpoint command needs. Adding here keeps the
 * surface aligned across `html`, `text`, `selected`, etc.
 */
export function addCommonScrapeOptions(cmd: Command): Command {
  return cmd
    .option('-k, --api-key <key>', 'API key (overrides $WEBSCRAPING_AI_API_KEY and config file)')
    .option('-o, --output <file>', 'write result to FILE instead of stdout')
    .option('--pretty', 'pretty-print JSON output (default on TTY)')
    .addOption(
      new Option('--no-pretty', 'force single-line JSON output').conflicts('pretty'),
    )
    .option('--js', 'execute JS via a headless browser (default: enabled)')
    .option('--no-js', 'disable JS execution (faster, cheaper)')
    .addOption(
      new Option('--proxy <type>', 'proxy pool').choices([
        'datacenter',
        'residential',
        'stealth',
      ]),
    )
    .option('--country <code>', 'two-letter proxy country code, e.g. us, gb, de')
    .addOption(
      new Option('--device <type>', 'device emulation').choices(['desktop', 'mobile', 'tablet']),
    )
    .option('--timeout <ms>', 'page-retrieval timeout in ms (max 30000)', integerParser)
    .option('--js-timeout <ms>', 'JS rendering time in ms after load (max 20000)', integerParser)
    .option('--wait-for <selector>', 'CSS selector to wait for before returning content')
    .option(
      '--headers <json>',
      'HTTP headers to forward to the target page; JSON object or @file.json',
    )
    .option('--js-script <code>', 'custom JS to evaluate on the target page')
    .option('--custom-proxy <url>', 'custom proxy URL: http://user:pass@host:port')
    .option('--error-on-404', 'return error on 404')
    .option('--error-on-redirect', 'return error on redirect');
}

export function integerParser(value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) throw new Error(`expected integer, got: ${value}`);
  return n;
}

/**
 * Parse a `--headers` argument. Accepts a JSON object literal or `@path` to
 * load JSON from a file. Returns `undefined` if the input is empty.
 */
export async function parseHeaders(input: string | undefined): Promise<Record<string, string> | undefined> {
  if (!input || input.trim() === '') return undefined;
  const text = input.startsWith('@') ? await fs.readFile(input.slice(1), 'utf8') : input;
  return parseJsonObject(text, 'headers');
}

/**
 * Parse a `--fields` argument for `extract`. Accepts JSON object literal or
 * `@path` to a file.
 */
export async function parseFields(input: string): Promise<Record<string, string>> {
  const text = input.startsWith('@') ? await fs.readFile(input.slice(1), 'utf8') : input;
  const parsed = parseJsonObject(text, 'fields');
  if (!parsed || Object.keys(parsed).length === 0) {
    throw new Error('fields must be a non-empty JSON object of { fieldName: description }');
  }
  return parsed;
}

function parseJsonObject(text: string, label: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`${label}: invalid JSON — ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v !== 'string') throw new Error(`${label}.${k}: value must be a string`);
    out[k] = v;
  }
  return out;
}
