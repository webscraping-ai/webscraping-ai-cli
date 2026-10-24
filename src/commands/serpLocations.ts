import { Command } from 'commander';

import { buildSerpLocationsOptions } from '../lib/buildRequest.js';
import { resolveApiKey } from '../lib/config.js';
import { EXIT_CODES } from '../lib/errors.js';
import { isPositiveIntegerString } from '../lib/options.js';
import { emit } from '../lib/output.js';
import { createClient } from '../lib/sdk.js';

interface SerpLocationsFlags {
  /** Raw `--limit` string; validated strictly in the action. */
  limit?: string;
  apiKey?: string;
  output?: string;
  pretty?: boolean;
}

/**
 * `serp-locations [query...]` — look up names for `serp --location` (wraps
 * /serp/locations). Prints a JSON array of up to 10 locations, most populous
 * first; pass a result's `canonical_name` (or `id`) as `--location`. Matches
 * English names. Multiple words are joined with spaces; without a query the
 * most populous locations are returned. The endpoint is free and needs no
 * API key, but the CLI sends the configured one like every other command.
 *
 * There is no stdin mode, so a lone `-` is a usage error. That and a bad
 * `--limit` exit with code 2 before the API key is resolved.
 */
export function serpLocationsCommand(): Command {
  const cmd = new Command('serp-locations')
    .description(
      'Look up names for `serp --location` and print them as a JSON array (wraps /serp/locations, free)',
    )
    .argument('[query...]', 'part of a location name, e.g. austin (default: most populous)')
    .option('--limit <n>', 'maximum number of locations, integer 1-10 (default: 10)')
    .option('-k, --api-key <key>', 'API key (overrides $WEBSCRAPING_AI_API_KEY and config file)')
    .option('-o, --output <file>', 'write result to FILE instead of stdout')
    .option('--pretty', 'pretty-print JSON output (default on TTY)')
    .option('--no-pretty', 'force single-line JSON output');

  cmd.action(async (words: string[], opts: SerpLocationsFlags) => {
    let limit: number | undefined;
    if (opts.limit !== undefined) {
      if (!isPositiveIntegerString(opts.limit)) {
        cmd.error(`error: --limit must be an integer >= 1, got: ${opts.limit}`, {
          exitCode: EXIT_CODES.usage,
          code: 'wsai.invalidLimit',
        });
      }
      limit = Number(opts.limit);
    }

    const query = words.join(' ');
    if (query === '-') {
      cmd.error('error: serp-locations has no stdin mode; pass the query as an argument', {
        exitCode: EXIT_CODES.usage,
        code: 'wsai.stdinUnsupported',
      });
    }

    const options = buildSerpLocationsOptions(query, limit);
    const apiKey = await resolveApiKey({ flag: opts.apiKey });
    const client = createClient({ apiKey });
    const result = await client.serpLocations(options);
    await emit(result, opts);
  });

  return cmd;
}
