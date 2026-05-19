import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  EDITORS,
  editorById,
  installSkill,
  resolveTarget,
} from '../src/lib/skill.js';

let workdir: string;
let fakeSource: string;

beforeAll(async () => {
  workdir = await fs.mkdtemp(join(tmpdir(), 'wsai-skill-'));
  fakeSource = join(workdir, 'src-skill');
  await fs.mkdir(fakeSource, { recursive: true });
  await fs.writeFile(join(fakeSource, 'SKILL.md'), '# test skill body\n');
  await fs.writeFile(join(fakeSource, 'extra.md'), 'companion doc\n');
});

afterAll(async () => {
  await fs.rm(workdir, { recursive: true, force: true });
});

describe('editors registry', () => {
  it('exposes a non-empty list with unique ids', () => {
    expect(EDITORS.length).toBeGreaterThan(0);
    const ids = EDITORS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains the editors the user picked at v1', () => {
    const ids = new Set(EDITORS.map((e) => e.id));
    for (const expected of [
      'claude-code',
      'cursor',
      'windsurf',
      'kiro',
      'opencode',
      'gemini',
      'copilot',
      'augment',
      'factory',
    ]) {
      expect(ids.has(expected)).toBe(true);
    }
  });

  it('lookup returns adapter or undefined', () => {
    expect(editorById('claude-code')?.label).toBe('Claude Code');
    expect(editorById('nope')).toBeUndefined();
  });
});

describe('resolveTarget', () => {
  it('uses $HOME for user-scope editors', () => {
    const editor = editorById('claude-code');
    expect(editor).toBeDefined();
    const target = resolveTarget(editor!, { home: '/fake/home', cwd: '/fake/cwd' });
    expect(target.destination).toBe('/fake/home/.claude/skills/webscraping-ai');
  });

  it('uses CWD for project-scope editors', () => {
    const editor = editorById('copilot');
    expect(editor).toBeDefined();
    const target = resolveTarget(editor!, { home: '/fake/home', cwd: '/fake/cwd' });
    expect(target.destination).toBe('/fake/cwd/.github/copilot-instructions.md');
  });
});

describe('installSkill', () => {
  it('copies the whole directory for dir-mode editors', async () => {
    const editor = editorById('claude-code')!;
    const dest = join(workdir, 'claude-home');
    const target = resolveTarget(editor, { home: dest, cwd: workdir });
    const result = await installSkill(target, { sourceDir: fakeSource });
    expect(result.status).toBe('installed');
    expect(await fs.readFile(join(target.destination, 'SKILL.md'), 'utf8')).toMatch(/test skill body/);
    expect(await fs.readFile(join(target.destination, 'extra.md'), 'utf8')).toMatch(/companion/);
  });

  it('writes a single file for file-mode editors', async () => {
    const editor = editorById('copilot')!;
    const cwd = join(workdir, 'project');
    const target = resolveTarget(editor, { cwd, home: workdir });
    const result = await installSkill(target, { sourceDir: fakeSource });
    expect(result.status).toBe('installed');
    const written = await fs.readFile(target.destination, 'utf8');
    expect(written).toMatch(/test skill body/);
  });

  it('skips when destination exists without --force', async () => {
    const editor = editorById('cursor')!;
    const cwd = join(workdir, 'project-cursor');
    const target = resolveTarget(editor, { cwd, home: workdir });
    await installSkill(target, { sourceDir: fakeSource });
    const second = await installSkill(target, { sourceDir: fakeSource });
    expect(second.status).toBe('skipped-exists');
  });

  it('overwrites with --force', async () => {
    const editor = editorById('windsurf')!;
    const cwd = join(workdir, 'project-windsurf');
    const target = resolveTarget(editor, { cwd, home: workdir });
    await installSkill(target, { sourceDir: fakeSource });
    const second = await installSkill(target, { sourceDir: fakeSource, force: true });
    expect(second.status).toBe('overwritten');
  });
});
