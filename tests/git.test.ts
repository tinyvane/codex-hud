import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readGitBranch } from '../src/git.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'codex-hud-git-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeHead(dir: string, content: string): Promise<void> {
  await mkdir(join(dir, '.git'), { recursive: true });
  await writeFile(join(dir, '.git', 'HEAD'), content, 'utf8');
}

describe('readGitBranch', () => {
  it('returns branch name from ref pointer', async () => {
    await writeHead(tmpDir, 'ref: refs/heads/main\n');
    expect(await readGitBranch(tmpDir)).toBe('main');
  });

  it('returns branch name with no trailing newline', async () => {
    await writeHead(tmpDir, 'ref: refs/heads/feature/my-branch');
    expect(await readGitBranch(tmpDir)).toBe('feature/my-branch');
  });

  it('returns short hash for detached HEAD', async () => {
    await writeHead(tmpDir, 'abcdef1234567890abcdef1234567890abcdef12\n');
    expect(await readGitBranch(tmpDir)).toBe('abcdef1');
  });

  it('returns null when .git dir is missing', async () => {
    expect(await readGitBranch(tmpDir)).toBeNull();
  });

  it('returns null for unrecognized HEAD content', async () => {
    await writeHead(tmpDir, 'something unexpected\n');
    expect(await readGitBranch(tmpDir)).toBeNull();
  });

  it('walks up to parent directory to find .git', async () => {
    await writeHead(tmpDir, 'ref: refs/heads/parent-branch\n');
    const subDir = join(tmpDir, 'src', 'components');
    await mkdir(subDir, { recursive: true });
    expect(await readGitBranch(subDir)).toBe('parent-branch');
  });

  it('returns null for a path with no git repo in any ancestor', async () => {
    const isolated = await mkdtemp(join(tmpdir(), 'codex-hud-no-git-'));
    try {
      expect(await readGitBranch(isolated)).toBeNull();
    } finally {
      await rm(isolated, { recursive: true, force: true });
    }
  });
});
