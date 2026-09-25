import { Command, Option } from 'commander';

import { buildSerpOptions } from '../lib/buildRequest.js';
import type { SerpRawFlags } from '../lib/buildRequest.js';
import { resolveApiKey } from '../lib/config.js';
import { EXIT_CODES } from '../lib/errors.js';
import { isPositiveIntegerString } from '../lib/options.js';
import { createEmitter } from '../lib/output.js';
import { createClient } from '../lib/sdk.js';
import { queryIterator, urlIsStdin } from '../lib/stdin.js';

interface SerpFlags extends Omit<SerpRawFlags, 'page'> {
  /** Raw `--page` string; validated strictly in the action. */
  page?: string;
  apiKey?: string;
  output?: string;
  pretty?: boolean;
}

/**
 * `serp <query...>` — parsed search engine results (wraps /serp).
 *
 * Query-shaped, not URL-shaped, so none of the common scrape flags
 * (`--js`, `--proxy`, `--country`, …) apply and they're deliberately not
 * registered here. Multiple words are joined with spaces, so quoting the
 * query is optional. A lone `-` reads one query per line from stdin; only
 * blank lines are skipped (a leading `#` is part of the query, not a comment).
 *
 * Usage errors (bad `--page`, empty query) exit with code 2 before stdin is
 * read or the API key is resolved.
 */
export function serpCommand(): Command {
  const cmd = new Command('serp')
    .alias('search')
    .description('Search Google and print parsed results as JSON (wraps /serp, 15 credits/search)')
    .argument('<query...>', 'search query (or `-` to read queries from stdin, one per line)')
    .addOption(new Option('--engine <name>', 'search engine (default: google)').choices(['google']))
    .option('--gl <code>', 'two-letter country code for search geolocation (default: us)')
    .option('--hl <code>', 'two-letter language code for the results (default: en)')
    .option(
      '--page <n>',
      'results page number, integer >= 1, 10 results per page (default: 1; server rejects > 100 with a 400)',
    )
    .option('-k, --api-key <key>', 'API key (overrides $WEBSCRAPING_AI_API_KEY and config file)')
    .option('-o, --output <file>', 'write result to FILE instead of stdout')
    .option('--pretty', 'pretty-print JSON output (default on TTY)')
    .option('--no-pretty', 'force single-line JSON output');

  cmd.action(async (words: string[], opts: SerpFlags) => {
    const query = words.join(' ');

    let page: number | undefined;
    if (opts.page !== undefined) {
      if (!isPositiveIntegerString(opts.page)) {
        cmd.error(`error: --page must be an integer >= 1, got: ${opts.page}`, {
          exitCode: EXIT_CODES.usage,
          code: 'wsai.invalidPage',
        });
      }
      page = Number(opts.page);
    }
    if (!urlIsStdin(query) && query.trim() === '') {
      cmd.error('error: serp requires a non-empty query', {
        exitCode: EXIT_CODES.usage,
        code: 'wsai.emptyQuery',
      });
    }

    const flags: SerpRawFlags = { engine: opts.engine, gl: opts.gl, hl: opts.hl, page };
    const apiKey = await resolveApiKey({ flag: opts.apiKey });
    const client = createClient({ apiKey });
    const write = createEmitter(opts);

    for await (const q of queryIterator(query)) {
      const result = await client.serp(buildSerpOptions(q, flags));
      await write(result);
    }
  });

  return cmd;
}
