/**
 * Multi-editor skill installer.
 *
 * The canonical skill lives in this package at
 * `plugins/webscraping-ai/skills/webscraping-ai/SKILL.md`. Each supported
 * editor reads skill content from a different location and may want either
 * a single Markdown file or a whole skill directory. The `editors` registry
 * captures those differences so `setup skill` is a small driver over it.
 *
 * `mode: 'dir'` copies the entire skill directory (Claude Code-shaped
 * editors that scan a folder per skill). `mode: 'file'` writes the SKILL.md
 * contents to a single file (editors that read flat instructions, like
 * GitHub Copilot's `.github/copilot-instructions.md`).
 *
 * `kind: 'user'` writes to `$HOME`; `kind: 'project'` writes to the current
 * working directory. We prefer user-scope where the editor supports it so
 * the skill becomes globally available without polluting individual repos.
 */

import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type EditorMode = 'dir' | 'file';
export type EditorKind = 'user' | 'project';

export interface EditorAdapter {
  /** Stable identifier used by `--editor <name>`. */
  id: string;
  /** Human-readable label printed in summaries. */
  label: string;
  mode: EditorMode;
  kind: EditorKind;
  /**
   * Where the skill ends up. For `mode: 'dir'`, the skill directory copies
   * to `{root}/{path}`. For `mode: 'file'`, the SKILL.md contents write to
   * `{root}/{path}` (i.e. `path` ends in a filename).
   *
   * `root` is `$HOME` (user) or CWD (project).
   */
  path: string;
}

/**
 * Registry of supported editors. Order matters: it's also the order the
 * `setup skill` summary lists them in.
 */
export const EDITORS: readonly EditorAdapter[] = [
  // Claude Code: user-scope skills live under ~/.claude/skills/<name>/
  { id: 'claude-code', label: 'Claude Code', mode: 'dir', kind: 'user', path: '.claude/skills/webscraping-ai' },
  // Cursor: project-scope rule file. Cursor doesn't have a user-wide skill
  // dir, so this is the editor's "install" surface.
  { id: 'cursor', label: 'Cursor', mode: 'file', kind: 'project', path: '.cursor/rules/webscraping-ai.mdc' },
  // Windsurf: project-scope rules. Same shape as Cursor.
  { id: 'windsurf', label: 'Windsurf', mode: 'file', kind: 'project', path: '.windsurf/rules/webscraping-ai.md' },
  // Kiro: user-scope steering directory.
  { id: 'kiro', label: 'Kiro', mode: 'dir', kind: 'user', path: '.kiro/steering/webscraping-ai' },
  // OpenCode: project-scope skills (mirrors Claude shape).
  { id: 'opencode', label: 'OpenCode', mode: 'dir', kind: 'project', path: '.opencode/skills/webscraping-ai' },
  // Gemini CLI: user-scope extension dir with a GEMINI.md.
  { id: 'gemini', label: 'Gemini CLI', mode: 'file', kind: 'user', path: '.gemini/extensions/webscraping-ai/GEMINI.md' },
  // GitHub Copilot: project-scope custom instructions file. Single file.
  { id: 'copilot', label: 'GitHub Copilot', mode: 'file', kind: 'project', path: '.github/copilot-instructions.md' },
  // Augment: project-scope rules file.
  { id: 'augment', label: 'Augment', mode: 'file', kind: 'project', path: '.augment/rules/webscraping-ai.md' },
  // Factory: project-scope rules file.
  { id: 'factory', label: 'Factory', mode: 'file', kind: 'project', path: '.factory/rules/webscraping-ai.md' },
] as const;

export function editorById(id: string): EditorAdapter | undefined {
  return EDITORS.find((e) => e.id === id);
}

/**
 * Where this package keeps the canonical skill. Resolved relative to the
 * compiled `dist/cli.js` so it works after `npm install -g`.
 */
export function bundledSkillDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/ sits at the package root, so the plugins dir is two levels up
  // from any compiled file: dist/cli.js → package root → plugins/...
  return resolve(here, '..', 'plugins', 'webscraping-ai', 'skills', 'webscraping-ai');
}

export interface InstallTarget {
  editor: EditorAdapter;
  /** Absolute destination path (file or directory depending on `mode`). */
  destination: string;
}

export interface ResolveOptions {
  cwd?: string;
  home?: string;
}

export function resolveTarget(editor: EditorAdapter, opts: ResolveOptions = {}): InstallTarget {
  const root = editor.kind === 'user' ? (opts.home ?? homedir()) : (opts.cwd ?? process.cwd());
  return { editor, destination: join(root, editor.path) };
}

export interface InstallOptions {
  /** If true, overwrite existing files/dirs. */
  force?: boolean;
  /** Override skill source dir (for tests). */
  sourceDir?: string;
}

export type InstallStatus = 'installed' | 'skipped-exists' | 'overwritten';

export interface InstallResult {
  target: InstallTarget;
  status: InstallStatus;
}

export async function installSkill(
  target: InstallTarget,
  opts: InstallOptions = {},
): Promise<InstallResult> {
  const source = opts.sourceDir ?? bundledSkillDir();
  const exists = await pathExists(target.destination);

  if (exists && !opts.force) {
    return { target, status: 'skipped-exists' };
  }

  if (target.editor.mode === 'dir') {
    if (exists) await fs.rm(target.destination, { recursive: true, force: true });
    await copyDirectory(source, target.destination);
  } else {
    const skillBody = await fs.readFile(join(source, 'SKILL.md'), 'utf8');
    await fs.mkdir(dirname(target.destination), { recursive: true });
    await fs.writeFile(target.destination, skillBody);
  }

  return { target, status: exists ? 'overwritten' : 'installed' };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function copyDirectory(source: string, destination: string): Promise<void> {
  // `fs.cp` with `recursive` exists on Node 16.7+; we target Node 20.
  await fs.cp(source, destination, { recursive: true, force: true });
}
