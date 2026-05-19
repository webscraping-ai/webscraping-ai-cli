import { Command, Option } from 'commander';

import { buildQuestionOptions } from '../lib/buildRequest.js';
import { resolveApiKey } from '../lib/config.js';
import { addCommonScrapeOptions, parseHeaders } from '../lib/options.js';
import type { CommonRawFlags } from '../lib/options.js';
import { emit } from '../lib/output.js';
import { createClient } from '../lib/sdk.js';
import { urlIterator } from '../lib/stdin.js';

interface AskFlags extends CommonRawFlags {
  question?: string;
}

export function askCommand(): Command {
  const cmd = new Command('ask')
    .description('Ask an AI question about a page (wraps /ai/question)')
    .argument('<url>', 'page URL (or `-` to read URLs from stdin)')
    .requiredOption('-q, --question <text>', 'the question / instructions for the model')
    .addOption(new Option('--format <fmt>', 'response wrapping').choices(['text', 'json']));

  addCommonScrapeOptions(cmd);

  cmd.action(async (url: string, opts: AskFlags) => {
    if (!opts.question) throw new Error('--question is required');
    const apiKey = await resolveApiKey({ flag: opts.apiKey });
    const headers = await parseHeaders(opts.headers);
    const client = createClient({ apiKey, requestTimeoutMs: opts.timeout });

    for await (const target of urlIterator(url)) {
      const sdkOptions = buildQuestionOptions(target, opts.question, opts, { headers });
      const result = await client.question(sdkOptions);
      await emit(result, opts);
    }
  });

  return cmd;
}
