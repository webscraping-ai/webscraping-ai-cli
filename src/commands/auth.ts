import { Command } from 'commander';

import {
  clearPersistedConfig,
  configPath,
  maskApiKey,
  readPersistedConfig,
  writePersistedConfig,
} from '../lib/config.js';

export function authCommand(): Command {
  const cmd = new Command('auth').description('Manage your stored API key');

  cmd
    .command('set <key>')
    .description(`Save an API key to ${configPath()}`)
    .action(async (key: string) => {
      if (!key || key.trim() === '') throw new Error('API key is empty');
      await writePersistedConfig({ apiKey: key.trim() });
      process.stdout.write(`API key saved to ${configPath()}\n`);
    });

  cmd
    .command('show')
    .description('Display the currently stored API key (masked)')
    .action(async () => {
      const persisted = await readPersistedConfig();
      const env = process.env.WEBSCRAPING_AI_API_KEY;
      if (env && env.trim() !== '') {
        process.stdout.write(`Active key (env WEBSCRAPING_AI_API_KEY): ${maskApiKey(env.trim())}\n`);
      }
      if (persisted.apiKey && persisted.apiKey.trim() !== '') {
        process.stdout.write(
          `Stored key (${configPath()}): ${maskApiKey(persisted.apiKey.trim())}\n`,
        );
      }
      if (!env && !persisted.apiKey) {
        process.stdout.write('No API key configured. Run `webscraping-ai auth set <key>`.\n');
      }
    });

  cmd
    .command('clear')
    .description('Remove the stored API key file')
    .action(async () => {
      const removed = await clearPersistedConfig();
      process.stdout.write(removed ? `Removed ${configPath()}\n` : 'No stored API key to remove.\n');
    });

  return cmd;
}
