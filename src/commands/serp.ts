import { Command, Option } from 'commander';

import { buildSerpOptions } from '../lib/buildRequest.js';
import type { SerpRawFlags } from '../lib/buildRequest.js';
import { resolveApiKey } from '../lib/config.js';
import { integerParser } from '../lib/options.js';
import { emit } from '../lib/output.js';
import { createClient } from '../lib/sdk.js';
import { urlIterator } from '../lib/stdin.js';

interface SerpFlags extends SerpRawFlags {
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
 * query is optional. A lone `-` reads one query per line from stdin.
 */
export function serpCommand(): Command {
  return new Command('serp')
    .alias('search')
    .description('Search Google and print parsed results as JSON (wraps /serp, 15 credits/search)')
    .argument('<query...>', 'search query (or `-` to read queries from stdin, one per line)')
    .addOption(new Option('--engine <name>', 'search engine (default: google)').choices(['google']))
    .option('--gl <code>', 'two-letter country code for search geolocation (default: us)')
    .option('--hl <code>', 'two-letter language code for the results (default: en)')
    .option('--page <n>', 'results page number, 10 results per page (default: 1)', integerParser)
    .option('-k, --api-key <key>', 'API key (overrides $WEBSCRAPING_AI_API_KEY and config file)')
    .option('-o, --output <file>', 'write result to FILE instead of stdout')
    .option('--pretty', 'pretty-print JSON output (default on TTY)')
    .addOption(new Option('--no-pretty', 'force single-line JSON output').conflicts('pretty'))
    .action(async (words: string[], opts: SerpFlags) => {
      const query = words.join(' ');
      const apiKey = await resolveApiKey({ flag: opts.apiKey });
      const client = createClient({ apiKey });

      for await (const q of urlIterator(query)) {
        const result = await client.serp(buildSerpOptions(q, opts));
        await emit(result, opts);
      }
    });
}
