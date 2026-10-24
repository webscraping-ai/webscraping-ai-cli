import { Command, Option } from 'commander';

import { buildSerpOptions } from '../lib/buildRequest.js';
import type { SerpRawFlags } from '../lib/buildRequest.js';
import { resolveApiKey } from '../lib/config.js';
import { EXIT_CODES } from '../lib/errors.js';
import { isDecimalString, isPositiveIntegerString } from '../lib/options.js';
import { openEmitter } from '../lib/output.js';
import { createClient } from '../lib/sdk.js';
import { queryIterator, urlIsStdin } from '../lib/stdin.js';

type NumericFlag = 'page' | 'pages' | 'lat' | 'lon' | 'radius';

interface SerpFlags extends Omit<SerpRawFlags, NumericFlag> {
  /** Raw numeric flag strings; validated strictly in the action. */
  page?: string;
  pages?: string;
  lat?: string;
  lon?: string;
  radius?: string;
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
 * Every search runs from one fixed location (`--location`, `--lat` +
 * `--lon` or `--uule`, otherwise the capital of the `--gl` country). Which of
 * those combine, and their ranges, are checked server-side (400, not billed).
 * Negative coordinates work as `--lat -33.86`: an option's value is taken
 * even when it starts with `-`.
 *
 * Usage errors (bad `--page`/`--pages`/`--radius`/`--lat`/`--lon`, empty
 * query) exit with code 2 before stdin is read or the API key is resolved.
 */
export function serpCommand(): Command {
  const cmd = new Command('serp')
    .alias('search')
    .description('Search Google and print parsed results as JSON (wraps /serp)')
    .argument('<query...>', 'search query (or `-` to read queries from stdin, one per line)')
    .addOption(new Option('--engine <name>', 'search engine (default: google)').choices(['google']))
    .option(
      '--gl <code>',
      'two-letter country code for the search (default: the country of --location, --lat/--lon or --uule, otherwise us)',
    )
    .option('--hl <code>', 'two-letter language code for the results (default: en)')
    .option(
      '--page <n>',
      'results page number, integer >= 1, 10 results per page (default: 1; server rejects > 100 with a 400)',
    )
    .option(
      '--pages <n>',
      'consecutive results pages to fetch in one call starting at --page, 1-5, returned as one de-duplicated list (default: 1; billed per page returned)',
    )
    .option(
      '--location <name>',
      'where the search runs from: a name like "Austin, TX" or "Austin,Texas,United States", or an id from `serp-locations`',
    )
    .option('--uule <value>', 'Google-encoded location (w+CAIQICI… or a+…)')
    .option(
      '--lat <deg>',
      'latitude of the search origin in decimal degrees (-90 to 90; needs --lon)',
    )
    .option(
      '--lon <deg>',
      'longitude of the search origin in decimal degrees (-180 to 180; needs --lat)',
    )
    .option('--radius <m>', 'radius in meters around --location or --lat/--lon, integer 1-1000')
    .option('-k, --api-key <key>', 'API key (overrides $WEBSCRAPING_AI_API_KEY and config file)')
    .option('-o, --output <file>', 'write result to FILE instead of stdout')
    .option('--pretty', 'pretty-print JSON output (default on TTY)')
    .option('--no-pretty', 'force single-line JSON output');

  cmd.action(async (words: string[], opts: SerpFlags) => {
    const query = words.join(' ');

    const usage = (message: string, code: string): never =>
      cmd.error(`error: ${message}`, { exitCode: EXIT_CODES.usage, code });
    const integer = (name: NumericFlag, value: string | undefined): number | undefined => {
      if (value === undefined) return undefined;
      if (!isPositiveIntegerString(value)) {
        usage(
          `--${name} must be an integer >= 1, got: ${value}`,
          `wsai.invalid${capitalize(name)}`,
        );
      }
      return Number(value);
    };
    const decimal = (name: NumericFlag, value: string | undefined): number | undefined => {
      if (value === undefined) return undefined;
      if (!isDecimalString(value)) {
        usage(
          `--${name} must be a decimal number, e.g. -33.86, got: ${value}`,
          `wsai.invalid${capitalize(name)}`,
        );
      }
      return Number(value);
    };

    const page = integer('page', opts.page);
    const pages = integer('pages', opts.pages);
    const radius = integer('radius', opts.radius);
    const lat = decimal('lat', opts.lat);
    const lon = decimal('lon', opts.lon);

    if (!urlIsStdin(query) && query.trim() === '') {
      cmd.error('error: serp requires a non-empty query', {
        exitCode: EXIT_CODES.usage,
        code: 'wsai.emptyQuery',
      });
    }

    const flags: SerpRawFlags = {
      engine: opts.engine,
      gl: opts.gl,
      hl: opts.hl,
      page,
      pages,
      location: opts.location,
      uule: opts.uule,
      lat,
      lon,
      radius,
    };
    const apiKey = await resolveApiKey({ flag: opts.apiKey });
    const client = createClient({ apiKey });
    const write = await openEmitter(opts, query);

    for await (const q of queryIterator(query)) {
      const result = await client.serp(buildSerpOptions(q, flags));
      await write(result);
    }
  });

  return cmd;
}

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}
