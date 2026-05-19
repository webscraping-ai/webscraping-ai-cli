import { Command } from 'commander';

import { buildFieldsOptions } from '../lib/buildRequest.js';
import { resolveApiKey } from '../lib/config.js';
import { addCommonScrapeOptions, parseFields, parseHeaders } from '../lib/options.js';
import type { CommonRawFlags } from '../lib/options.js';
import { emit } from '../lib/output.js';
import { createClient } from '../lib/sdk.js';
import { urlIterator } from '../lib/stdin.js';

interface ExtractFlags extends CommonRawFlags {
  fields?: string;
}

export function extractCommand(): Command {
  const cmd = new Command('extract')
    .description('Extract structured fields from a page using AI (wraps /ai/fields)')
    .argument('<url>', 'page URL (or `-` to read URLs from stdin)')
    .requiredOption(
      '-f, --fields <json>',
      'fields to extract — JSON object {name: description} or @file.json',
    );

  addCommonScrapeOptions(cmd);

  cmd.action(async (url: string, opts: ExtractFlags) => {
    if (!opts.fields) throw new Error('--fields is required');
    const apiKey = await resolveApiKey({ flag: opts.apiKey });
    const headers = await parseHeaders(opts.headers);
    const fields = await parseFields(opts.fields);
    const client = createClient({ apiKey, requestTimeoutMs: opts.timeout });

    for await (const target of urlIterator(url)) {
      const sdkOptions = buildFieldsOptions(target, fields, opts, { headers });
      const result = await client.fields(sdkOptions);
      await emit(result, opts);
    }
  });

  return cmd;
}
