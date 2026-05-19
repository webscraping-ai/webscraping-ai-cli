import { Command, Option } from 'commander';

import { buildTextOptions } from '../lib/buildRequest.js';
import { resolveApiKey } from '../lib/config.js';
import { addCommonScrapeOptions, parseHeaders } from '../lib/options.js';
import type { CommonRawFlags } from '../lib/options.js';
import { emit } from '../lib/output.js';
import { createClient } from '../lib/sdk.js';
import { urlIterator } from '../lib/stdin.js';

interface TextFlags extends CommonRawFlags {
  textFormat?: 'plain' | 'json' | 'xml';
  returnLinks?: boolean;
}

export function textCommand(): Command {
  const cmd = new Command('text')
    .description('Fetch the visible text of a page')
    .argument('<url>', 'page URL (or `-` to read URLs from stdin)')
    .addOption(
      new Option('--text-format <fmt>', 'text response format').choices(['plain', 'json', 'xml']),
    )
    .option('--return-links', 'include page links (text-format=json only)');

  addCommonScrapeOptions(cmd);

  cmd.action(async (url: string, opts: TextFlags) => {
    const apiKey = await resolveApiKey({ flag: opts.apiKey });
    const headers = await parseHeaders(opts.headers);
    const client = createClient({ apiKey, requestTimeoutMs: opts.timeout });

    for await (const target of urlIterator(url)) {
      const sdkOptions = buildTextOptions(target, opts, { headers }, {
        textFormat: opts.textFormat,
        returnLinks: opts.returnLinks,
      });
      const result = await client.text(sdkOptions);
      await emit(result, opts);
    }
  });

  return cmd;
}
