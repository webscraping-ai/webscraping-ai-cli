import { Command } from 'commander';

import { EDITORS, editorById, installSkill, resolveTarget } from '../lib/skill.js';
import type { EditorAdapter } from '../lib/skill.js';

interface SetupSkillFlags {
  editor?: string[];
  all?: boolean;
  force?: boolean;
}

export function setupCommand(): Command {
  const cmd = new Command('setup').description('Install the AI agent skill into your editor(s)');

  cmd
    .command('skill')
    .description('Install the WebScraping.AI skill into one or more AI coding editors')
    .option(
      '-e, --editor <id>',
      `editor id (repeatable). Supported: ${EDITORS.map((e) => e.id).join(', ')}`,
      collect,
      [] as string[],
    )
    .option('-a, --all', 'install into every supported editor')
    .option('-f, --force', 'overwrite existing skill files')
    .action(async (opts: SetupSkillFlags) => {
      const selected = resolveSelection(opts);
      if (selected.length === 0) {
        throw new Error(
          'no editor selected — pass --all or --editor <id> (e.g. --editor claude-code)',
        );
      }

      for (const editor of selected) {
        const target = resolveTarget(editor);
        const result = await installSkill(target, { force: opts.force });
        process.stdout.write(`${editor.label}: ${result.status} → ${target.destination}\n`);
      }
    });

  cmd
    .command('list', { hidden: false })
    .description('List supported editors for `setup skill`')
    .action(() => {
      for (const e of EDITORS) {
        const target = resolveTarget(e);
        process.stdout.write(`${e.id.padEnd(14)} ${e.label.padEnd(18)} ${target.destination}\n`);
      }
    });

  return cmd;
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function resolveSelection(opts: SetupSkillFlags): EditorAdapter[] {
  if (opts.all) return [...EDITORS];
  const ids = opts.editor ?? [];
  return ids.map((id) => {
    const editor = editorById(id);
    if (!editor) throw new Error(`unknown editor: ${id}`);
    return editor;
  });
}
