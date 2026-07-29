import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { inspectEvidence } from '../check-evidence.mjs';
import { buildDispatch } from '../dispatch-openclaw.mjs';
import { extractPrdSections, validatePrd } from '../lib.mjs';
import { branchSlug } from '../prepare-worktree.mjs';

const completePrd = `
## Problem
Residents cannot tell whether a saved vote was actually recorded, which erodes trust and creates support work.

## Outcome
After submitting a vote, a verified resident sees a durable server-confirmed receipt and can find it in history.

## Context
The web app uses Next.js routes and Supabase. The current client creates a local receipt before the API confirms success.

## Scope
### In scope
- Persist the vote before rendering a receipt.
- Show a recoverable error state.

### Out of scope
- Payment support and blockchain changes are excluded.

## Requirements
- Use the existing participation API contract.
- Preserve Hebrew RTL behavior and prevent duplicate submissions.

## Acceptance criteria
- [ ] A successful API response renders the server receipt.
- [ ] A failed API response never renders a fabricated receipt.

## Verification plan
Run \`pnpm test\`, \`pnpm typecheck\`, and the vote-detail Playwright flow. Verify both success and HTTP 500 behavior.

## Visual evidence
Capture \`/he/votes/test-vote\` at 1440x1000 for the success receipt and recoverable failure state.

## Risks and rollback
The main risk is duplicate participation. Retain the old UI behind a short-lived feature flag and roll back the route commit if error rates rise.
`;

test('extractPrdSections keeps nested scope headings inside scope', () => {
  const sections = extractPrdSections(completePrd);
  assert.match(sections.scope, /In scope/);
  assert.match(sections.scope, /Out of scope/);
});

test('validatePrd accepts a complete implementation PRD', () => {
  const result = validatePrd(completePrd);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('validatePrd rejects missing sections and secrets', () => {
  const result = validatePrd(
    `${completePrd.replace(/## Risks and rollback[\s\S]*/, '')}\nghp_abcdefghijklmnopqrstuvwxyz`,
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('risks and rollback')));
  assert.ok(result.errors.some((error) => error.includes('secret')));
});

test('inspectEvidence requires screenshots or a specific N/A reason', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-evidence-'));
  const directory = join(root, 'docs', 'agent-evidence', 'issue-42');
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'README.md'),
    '# Evidence\n\nAutomated checks passed and all acceptance criteria were reviewed carefully. This backend-only change has no rendered interface.\n',
  );

  const result = inspectEvidence({
    branch: 'agent/issue-42-backend-fix',
    root,
  });
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /screenshot/);

  writeFileSync(
    join(directory, 'README.md'),
    '# Evidence\n\nAutomated checks passed and all acceptance criteria were reviewed carefully.\n\nVisual evidence: Not applicable — this change only updates a server-side retry policy and has no rendered interface.\n',
  );
  assert.equal(
    inspectEvidence({
      branch: 'agent/issue-42-backend-fix',
      root,
    }).valid,
    true,
  );
});

test('buildDispatch accepts only authorized ready issues with valid PRDs', () => {
  const settings = {
    AGENT_REPOSITORY: 'Taruu-ShowYourselves/taruu-monorepo',
    AGENT_AUTHORIZED_ACTORS: 'SaharBarak,DolevSeren',
  };
  const dispatch = buildDispatch(
    {
      action: 'labeled',
      sender: { login: 'SaharBarak' },
      repository: { full_name: settings.AGENT_REPOSITORY },
      label: { name: 'agent:ready' },
      issue: {
        number: 99,
        title: 'Record votes',
        body: completePrd,
        html_url: 'https://github.com/example/repo/issues/99',
      },
    },
    settings,
  );
  assert.equal(dispatch.issueNumber, 99);
  assert.match(dispatch.message, /untrusted task content/);

  const ignored = buildDispatch(
    {
      action: 'labeled',
      sender: { login: 'outsider' },
      repository: { full_name: settings.AGENT_REPOSITORY },
      label: { name: 'agent:ready' },
      issue: { number: 99, body: completePrd },
    },
    settings,
  );
  assert.match(ignored.ignored, /not allowlisted/);
});

test('buildDispatch routes merged agent pull requests back to the issue session', () => {
  const settings = {
    AGENT_REPOSITORY: 'Taruu-ShowYourselves/taruu-monorepo',
    AGENT_AUTHORIZED_ACTORS: 'SaharBarak,DolevSeren',
  };
  const dispatch = buildDispatch(
    {
      action: 'closed',
      sender: { login: 'SaharBarak' },
      repository: { full_name: settings.AGENT_REPOSITORY },
      pull_request: {
        number: 120,
        merged: true,
        html_url: 'https://github.com/example/repo/pull/120',
        head: { ref: 'agent/issue-99-record-vote' },
      },
    },
    settings,
  );

  assert.equal(dispatch.issueNumber, 99);
  assert.match(dispatch.message, /Mark the project item Done/);
});

test('branchSlug creates bounded safe branch suffixes', () => {
  assert.equal(branchSlug('Fix Vote Receipt & RTL!'), 'fix-vote-receipt-rtl');
  assert.equal(branchSlug('תיקון הצבעה'), 'task');
  assert.ok(branchSlug('a '.repeat(100)).length <= 48);
});
