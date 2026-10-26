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
 * `data <url>` — structured JSON for any public web page (wraps /data).
 *
 * URL-shaped, but the server picks fetching/proxy/parsing per page, so the
 * common scrape flags (`--js`, `--proxy`, `--headers`, …) don't apply and are
 * deliberately not registered. The URL is never checked client-side: some
 * sites have dedicated parsers, and for other pages the API learns the page's
 * structure on the first request, which can take up to about 45 seconds.
 * When learning takes longer, or another request is already learning that
 * site, the API answers HTTP 503
 * (`error_code: "structure_processing"`, `retry_after`, not charged); the SDK
 * throws a plain `APIError`, so the message and `(HTTP 503)` go to stderr and
 * the command exits 7 like other unmapped API errors. A page with no
 * structured data is a 422 (`structure_unavailable`, not charged), which also
 * exits 7. `-` reads one URL per line from stdin (blank and `#` lines
 * skipped, and the batch stops at the first failing item, like the other URL
 * commands). `--param key=value` passes extra parameters through.
 *
 * Usage errors (blank url, malformed/reserved `--param`) exit with code 2
 * before stdin is read or the API key is resolved.
 */
export function dataCommand(): Command {
  const cmd = new Command('data')
    .description(
      'Structured JSON for any public web page (wraps /data). The first request for a new ' +
        'kind of page can take up to about 45 seconds; if it takes longer it fails with ' +
        'HTTP 503 (exit 7, not charged): run it again after about 30 seconds',
    )
    .argument('<url>', 'page URL (or `-` to read URLs from stdin, one per line)')
    .option(
      '--country <code>',
      'two-letter country code of the proxy used to fetch the page (default: us)',
    )
    .option(
      '--transcript',
      'video pages on sites with a dedicated parser only: also fetch the transcript into data.transcript (null without matching captions; a failed transcript fetch fails the request with a 500, not charged)',
    )
    .option(
      '--transcript-language <code>',
      'with --transcript: caption language to pick, e.g. en or de (default: English, then the first track)',
    )
    .option('--param <key=value>', 'extra query parameter sent as-is (repeatable)', collect)
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
