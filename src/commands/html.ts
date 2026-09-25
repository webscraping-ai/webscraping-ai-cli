import { Command, Option } from 'commander';

import { buildHtmlOptions } from '../lib/buildRequest.js';
import { resolveApiKey } from '../lib/config.js';
import { addCommonScrapeOptions, parseHeaders } from '../lib/options.js';
import type { CommonRawFlags } from '../lib/options.js';
import { createEmitter } from '../lib/output.js';
import { createClient } from '../lib/sdk.js';
import { urlIterator } from '../lib/stdin.js';

interface HtmlFlags extends CommonRawFlags {
  returnScriptResult?: boolean;
}

export function htmlCommand(): Command {
  const cmd = new Command('html')
    .description('Fetch the full HTML of a page')
    .argument('<url>', 'page URL (or `-` to read URLs from stdin)')
    .addOption(
      new Option('--return-script-result', 'return the result of --js-script instead of HTML'),
    )
    .addOption(new Option('--format <fmt>', 'response wrapping').choices(['text', 'json']));

  addCommonScrapeOptions(cmd);

  cmd.action(async (url: string, opts: HtmlFlags) => {
    const apiKey = await resolveApiKey({ flag: opts.apiKey });
    const headers = await parseHeaders(opts.headers);
    const client = createClient({ apiKey, requestTimeoutMs: opts.timeout });

    const write = createEmitter(opts);

    for await (const target of urlIterator(url)) {
      const sdkOptions = buildHtmlOptions(
        target,
        opts,
        { headers },
        {
          returnScriptResult: opts.returnScriptResult,
        },
      );
      const result = await client.html(sdkOptions);
      await write(result);
    }
  });

  return cmd;
}
