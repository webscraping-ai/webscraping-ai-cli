import { Command } from 'commander';

import { resolveApiKey } from '../lib/config.js';
import { emit } from '../lib/output.js';
import { createClient } from '../lib/sdk.js';

interface AccountFlags {
  apiKey?: string;
  output?: string;
  pretty?: boolean;
}

export function accountCommand(): Command {
  return new Command('account')
    .description('Show account quota and usage information')
    .option('-k, --api-key <key>', 'API key (overrides $WEBSCRAPING_AI_API_KEY and config file)')
    .option('-o, --output <file>', 'write result to FILE instead of stdout')
    .option('--pretty', 'pretty-print JSON output (default on TTY)')
    .option('--no-pretty', 'force single-line JSON output')
    .action(async (opts: AccountFlags) => {
      const apiKey = await resolveApiKey({ flag: opts.apiKey });
      const client = createClient({ apiKey });
      const result = await client.account();
      await emit(result, opts);
    });
}
