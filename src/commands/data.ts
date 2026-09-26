import { Command } from 'commander';

import { buildDataOptions, parseDataParams } from '../lib/buildRequest.js';
import type { DataRawFlags } from '../lib/buildRequest.js';
import { resolveApiKey } from '../lib/config.js';
import { EXIT_CODES } from '../lib/errors.js';
import { openEmitter } from '../lib/output.js';
import { createClient } from '../lib/sdk.js';
import { urlIsStdin, urlIterator } from '../lib/stdin.js';

interface DataFlags extends DataRawFlags {
  apiKey?: string;
  output?: string;
  pretty?: boolean;
}

function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

/**
 * `data <url>` — structured JSON for a page on a supported site (wraps /data).
 *
 * URL-shaped, but the server picks fetching/proxy/parsing per site, so the
 * common scrape flags (`--js`, `--proxy`, `--headers`, …) don't apply and are
 * deliberately not registered. The URL is never checked against a list of
 * sites: new ones are added server-side. An unsupported URL or page type
 * returns a 400 that is not charged (exit code 3); its message lists what is
 * supported. `-` reads one URL per line from stdin (blank and `#` lines
 * skipped, and the batch stops at the first failing item, like the other URL
 * commands). `--param key=value` passes site-specific parameters through.
 *
 * Usage errors (blank url, malformed/reserved `--param`) exit with code 2
 * before stdin is read or the API key is resolved.
 */
export function dataCommand(): Command {
  const cmd = new Command('data')
    .description(
      'Structured JSON for a page on a supported site, e.g. YouTube, TikTok, X, LinkedIn, ' +
        'Instagram, Reddit (wraps /data, priced per site; more sites are added server-side, ' +
        'an unsupported URL or page type gets a 400, not charged, listing what is supported)',
    )
    .argument('<url>', 'page URL (or `-` to read URLs from stdin, one per line)')
    .option(
      '--country <code>',
      'two-letter country code of the proxy used to fetch the page (default: us)',
    )
    .option(
      '--transcript',
      'YouTube videos only: also fetch the transcript into data.transcript (null without matching captions; a failed transcript fetch fails the request with a 500, not charged)',
    )
    .option(
      '--transcript-language <code>',
      'caption language to pick, e.g. en or de (default: English, then the first track)',
    )
    .option(
      '--param <key=value>',
      'extra site-specific query parameter sent as-is (repeatable)',
      collect,
    )
    .option('-k, --api-key <key>', 'API key (overrides $WEBSCRAPING_AI_API_KEY and config file)')
    .option('-o, --output <file>', 'write result to FILE instead of stdout')
    .option('--pretty', 'pretty-print JSON output (default on TTY)')
    .option('--no-pretty', 'force single-line JSON output');

  cmd.action(async (url: string, opts: DataFlags) => {
    if (!urlIsStdin(url) && url.trim() === '') {
      cmd.error('error: data requires a non-empty url', {
        exitCode: EXIT_CODES.usage,
        code: 'wsai.emptyUrl',
      });
    }
    try {
      parseDataParams(opts.param);
    } catch (err) {
      cmd.error(`error: ${(err as Error).message}`, {
        exitCode: EXIT_CODES.usage,
        code: 'wsai.invalidParam',
      });
    }

    const flags: DataRawFlags = {
      country: opts.country,
      transcript: opts.transcript,
      transcriptLanguage: opts.transcriptLanguage,
      param: opts.param,
    };
    const apiKey = await resolveApiKey({ flag: opts.apiKey });
    const client = createClient({ apiKey });
    const write = await openEmitter(opts, url);

    for await (const target of urlIterator(url)) {
      const result = await client.data(buildDataOptions(target, flags));
      await write(result);
    }
  });

  return cmd;
}
