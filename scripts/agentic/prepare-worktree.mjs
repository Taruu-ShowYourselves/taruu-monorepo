#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { parseArgs } from './lib.mjs';

export function branchSlug(title) {
  const slug = String(title)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return slug || 'task';
}

function git(repositoryRoot, args, options = {}) {
  return execFileSync('git', ['-C', repositoryRoot, ...args], {
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export function prepareWorktree({
  issueNumber,
  title,
  repositoryRoot,
  worktreesRoot,
}) {
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    throw new Error('issueNumber must be a positive integer.');
  }
  if (!existsSync(join(repositoryRoot, '.git'))) {
    throw new Error(`Repository clone not found at ${repositoryRoot}.`);
  }

  const branch = `agent/issue-${issueNumber}-${branchSlug(title)}`;
  const worktree = resolve(worktreesRoot, `issue-${issueNumber}`);
  const registeredWorktrees = git(repositoryRoot, [
    'worktree',
    'list',
    '--porcelain',
  ]);
  const registered = registeredWorktrees
    .split(/\r?\n/)
    .some((line) => line === `worktree ${worktree}`);

  git(repositoryRoot, ['fetch', 'origin', 'main', '--prune']);

  if (!registered) {
    if (existsSync(worktree)) {
      throw new Error(
        `${worktree} exists but is not a registered git worktree; inspect it manually.`,
      );
    }

    let startRef = 'origin/main';
    try {
      git(repositoryRoot, [
        'show-ref',
        '--verify',
        `refs/remotes/origin/${branch}`,
      ]);
      startRef = `origin/${branch}`;
    } catch {
      // A new issue branch starts from the latest origin/main.
    }

    try {
      git(repositoryRoot, ['show-ref', '--verify', `refs/heads/${branch}`]);
      git(repositoryRoot, ['worktree', 'add', worktree, branch]);
    } catch {
      git(repositoryRoot, [
        'worktree',
        'add',
        '-b',
        branch,
        worktree,
        startRef,
      ]);
    }
  }

  git(worktree, ['config', 'user.name', 'Taruu Delivery Agent']);
  git(worktree, [
    'config',
    'user.email',
    'taruu-agent@users.noreply.github.com',
  ]);

  return { branch, worktree };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const issueNumber = Number(args.issue);
  const title = args.title ?? 'task';
  const repositoryRoot =
    args.repository ?? process.env.AGENT_REPOSITORY_ROOT ?? '/srv/taruu-agent/repo';
  const worktreesRoot =
    args.worktrees ?? process.env.AGENT_WORKTREES_ROOT ?? '/srv/taruu-agent/worktrees';

  try {
    const result = prepareWorktree({
      issueNumber,
      title,
      repositoryRoot,
      worktreesRoot,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
