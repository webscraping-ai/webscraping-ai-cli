/**
 * `webscraping-ai` / `wsai` CLI entry point.
 *
 * Wires every subcommand into a single commander root. Errors thrown from
 * subcommand actions land in the top-level `.catch`, which maps SDK
 * exception classes to stable exit codes (see `lib/errors.ts`).
 */

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { accountCommand } from './commands/account.js';
import { askCommand } from './commands/ask.js';
import { authCommand } from './commands/auth.js';
import { extractCommand } from './commands/extract.js';
import { htmlCommand } from './commands/html.js';
import { selectedCommand } from './commands/selected.js';
import { selectedMultipleCommand } from './commands/selectedMultiple.js';
import { setupCommand } from './commands/setupSkill.js';
import { textCommand } from './commands/text.js';
import { exitCodeFor, formatError } from './lib/errors.js';

function packageVersion(): string {
  // Read package.json at runtime so we don't need a code-gen step. The dist
  // bundle sits at `dist/cli.js`, so package.json is one directory up.
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = resolve(here, '..', 'package.json');
  const raw = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
  return raw.version;
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('webscraping-ai')
    .description(
      'Official CLI for the WebScraping.AI API. Fetch pages, ask AI, extract structured data.\n' +
        'Set $WEBSCRAPING_AI_API_KEY or run `webscraping-ai auth set <key>` first.',
    )
    .version(packageVersion(), '-v, --version', 'output the version number')
    .showHelpAfterError();

  program.addCommand(htmlCommand());
  program.addCommand(textCommand());
  program.addCommand(selectedCommand());
  program.addCommand(selectedMultipleCommand());
  program.addCommand(askCommand());
  program.addCommand(extractCommand());
  program.addCommand(accountCommand());
  program.addCommand(authCommand());
  program.addCommand(setupCommand());

  return program;
}

async function main(argv: string[]): Promise<void> {
  const program = buildProgram();
  try {
    await program.parseAsync(argv);
  } catch (err) {
    process.stderr.write(`Error: ${formatError(err)}\n`);
    process.exit(exitCodeFor(err));
  }
}

// Only execute when run as a script. When imported (e.g. from tests),
// `buildProgram` is the public surface and `main` stays dormant.
const entryPath = process.argv[1] ? fileURLToPath(import.meta.url) : '';
if (entryPath && process.argv[1] === entryPath) {
  main(process.argv).catch((err: unknown) => {
    process.stderr.write(`Error: ${formatError(err)}\n`);
    process.exit(exitCodeFor(err));
  });
}
