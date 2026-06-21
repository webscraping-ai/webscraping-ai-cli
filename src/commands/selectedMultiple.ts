import { Command } from 'commander';

import { buildSelectedMultipleOptions } from '../lib/buildRequest.js';
import { resolveApiKey } from '../lib/config.js';
import { addCommonScrapeOptions, parseHeaders } from '../lib/options.js';
import type { CommonRawFlags } from '../lib/options.js';
import { emit } from '../lib/output.js';
import { createClient } from '../lib/sdk.js';
import { urlIterator } from '../lib/stdin.js';

interface SelectedMultipleFlags extends CommonRawFlags {
  selector?: string[];
}

export function selectedMultipleCommand(): Command {
  const cmd = new Command('selected-multiple')
    .description('Fetch HTML of multiple CSS-selected page areas')
    .argument('<url>', 'page URL (or `-` to read URLs from stdin)')
    .option(
      '-s, --selector <css>',
      'CSS selector — pass multiple times for multiple selectors',
      collectMulti,
      [] as string[],
    );

  addCommonScrapeOptions(cmd);

  cmd.action(async (url: string, opts: SelectedMultipleFlags) => {
    // `--selector` is optional: omitting it returns whole-page HTML.
    const selectors = opts.selector ?? [];
    const apiKey = await resolveApiKey({ flag: opts.apiKey });
    const headers = await parseHeaders(opts.headers);
    const client = createClient({ apiKey, requestTimeoutMs: opts.timeout });

    for await (const target of urlIterator(url)) {
      const sdkOptions = buildSelectedMultipleOptions(target, selectors, opts, { headers });
      const result = await client.selectedMultiple(sdkOptions);
      await emit(result, opts);
    }
  });

  return cmd;
}

function collectMulti(value: string, previous: string[]): string[] {
  return [...previous, value];
}
