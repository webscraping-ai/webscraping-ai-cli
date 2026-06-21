import { Command, Option } from 'commander';

import { buildSelectedOptions } from '../lib/buildRequest.js';
import { resolveApiKey } from '../lib/config.js';
import { addCommonScrapeOptions, parseHeaders } from '../lib/options.js';
import type { CommonRawFlags } from '../lib/options.js';
import { emit } from '../lib/output.js';
import { createClient } from '../lib/sdk.js';
import { urlIterator } from '../lib/stdin.js';

interface SelectedFlags extends CommonRawFlags {
  selector?: string;
}

export function selectedCommand(): Command {
  const cmd = new Command('selected')
    .description('Fetch HTML of one CSS-selected page area')
    .argument('<url>', 'page URL (or `-` to read URLs from stdin)')
    .option(
      '-s, --selector <css>',
      'CSS selector for the target element(s); omit for whole-page HTML',
    )
    .addOption(new Option('--format <fmt>', 'response wrapping').choices(['text', 'json']));

  addCommonScrapeOptions(cmd);

  cmd.action(async (url: string, opts: SelectedFlags) => {
    const apiKey = await resolveApiKey({ flag: opts.apiKey });
    const headers = await parseHeaders(opts.headers);
    const client = createClient({ apiKey, requestTimeoutMs: opts.timeout });

    for await (const target of urlIterator(url)) {
      const sdkOptions = buildSelectedOptions(target, opts.selector, opts, { headers });
      const result = await client.selected(sdkOptions);
      await emit(result, opts);
    }
  });

  return cmd;
}
