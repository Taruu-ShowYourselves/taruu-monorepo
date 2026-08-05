import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { inspectEvidence } from '../check-evidence.mjs';
import { buildDispatch, parseCommand } from '../dispatch-openclaw.mjs';
import { extractPrdSections, validatePrd } from '../lib.mjs';
import { branchSlug } from '../prepare-worktree.mjs';
import { sendTelegramMessage, telegramHookDelivery } from '../telegram.mjs';

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
  assert.ok(
    result.errors.some((error) => error.includes('risks and rollback')),
  );
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

test('buildDispatch routes Dolev-assigned merged pull requests', () => {
  const settings = {
    AGENT_REPOSITORY: 'Taruu-ShowYourselves/taruu-monorepo',
    AGENT_AUTHORIZED_ACTORS: 'SaharBarak,DolevSeren',
    AGENT_OWNER_LOGIN: 'DolevSeren',
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
        assignees: [{ login: 'dOlEvSeReN' }],
      },
    },
    settings,
  );

  assert.equal(dispatch.issueNumber, 99);
  assert.match(dispatch.message, /Mark the project item Done/);
});

test('buildDispatch routes Dolev-assigned PR review events', () => {
  const settings = {
    AGENT_REPOSITORY: 'Taruu-ShowYourselves/taruu-monorepo',
    AGENT_AUTHORIZED_ACTORS: 'SaharBarak,DolevSeren',
    AGENT_OWNER_LOGIN: 'DolevSeren',
  };
  const dispatch = buildDispatch(
    {
      action: 'submitted',
      sender: { login: 'SaharBarak' },
      repository: { full_name: settings.AGENT_REPOSITORY },
      review: { state: 'approved', body: 'Looks good' },
      pull_request: {
        number: 120,
        html_url: 'https://github.com/example/repo/pull/120',
        head: { ref: 'agent/issue-99-record-vote' },
        assignees: [{ login: 'DolevSeren' }],
      },
    },
    settings,
  );
  assert.equal(dispatch.issueNumber, 99);
  assert.match(dispatch.message, /approved review/);
});

test('local PR dispatcher ignores PRs not assigned to its owner', () => {
  const settings = {
    AGENT_REPOSITORY: 'Taruu-ShowYourselves/taruu-monorepo',
    AGENT_AUTHORIZED_ACTORS: 'SaharBarak,DolevSeren',
    AGENT_OWNER_LOGIN: 'DolevSeren',
  };
  const dispatch = buildDispatch(
    {
      action: 'submitted',
      sender: { login: 'SaharBarak' },
      repository: { full_name: settings.AGENT_REPOSITORY },
      review: { state: 'approved', body: '' },
      pull_request: {
        number: 120,
        html_url: 'https://github.com/example/repo/pull/120',
        head: { ref: 'agent/issue-99-record-vote' },
        assignees: [{ login: 'SaharBarak' }],
      },
    },
    settings,
  );
  assert.match(dispatch.ignored, /not assigned exclusively to DolevSeren/);
});

test('branchSlug creates bounded safe branch suffixes', () => {
  assert.equal(branchSlug('Fix Vote Receipt & RTL!'), 'fix-vote-receipt-rtl');
  assert.equal(branchSlug('תיקון הצבעה'), 'task');
  assert.ok(branchSlug('a '.repeat(100)).length <= 48);
});

test('Telegram hook delivery fails closed without a configured owner chat', () => {
  assert.deepEqual(telegramHookDelivery({}), { deliver: false });
  assert.deepEqual(telegramHookDelivery({ TELEGRAM_CHAT_ID: '123456789' }), {
    deliver: true,
    channel: 'telegram',
    to: '123456789',
  });
});

test('Telegram notification sends plain text only to the configured chat', async () => {
  let request;
  const result = await sendTelegramMessage(
    {
      token: 'test-token',
      chatId: '123456789',
      text: 'Issue #99 started',
    },
    async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200 };
    },
  );

  assert.deepEqual(result, { skipped: false });
  assert.equal(
    request.url,
    'https://api.telegram.org/bottest-token/sendMessage',
  );
  assert.deepEqual(JSON.parse(request.options.body), {
    chat_id: '123456789',
    text: 'Issue #99 started',
    disable_web_page_preview: true,
  });
});

const commentSettings = {
  AGENT_REPOSITORY: 'Taruu-ShowYourselves/taruu-monorepo',
  AGENT_AUTHORIZED_ACTORS: 'SaharBarak,DolevSeren',
  AGENT_OWNER_LOGIN: 'SaharBarak',
};

function commentEvent(overrides = {}) {
  const { issue = {}, comment = {}, ...rest } = overrides;
  return {
    action: 'created',
    repository: { full_name: commentSettings.AGENT_REPOSITORY },
    sender: { login: 'SaharBarak' },
    comment: { body: 'openclaw test', ...comment },
    issue: {
      number: 93,
      html_url: 'https://github.com/example/repo/pull/93',
      pull_request: { url: 'https://api.github.com/pulls/93' },
      assignees: [],
      ...issue,
    },
    ...rest,
  };
}

test('parseCommand accepts only a bare command on the first line', () => {
  assert.equal(parseCommand('openclaw test'), 'test');
  assert.equal(parseCommand('  OpenClaw   Work  '), 'work');
  assert.equal(parseCommand('openclaw test\nplease be quick'), 'test');
  // Prose that merely mentions the agent is not a command.
  assert.equal(parseCommand('I think openclaw test would help here'), null);
  assert.equal(parseCommand('openclaw test the login page'), null);
  assert.equal(parseCommand('```\nopenclaw test\n```'), null);
  assert.equal(parseCommand(''), null);
  assert.equal(parseCommand(undefined), null);
});

test('openclaw test dispatches a read-only run on a pull request', () => {
  const dispatch = buildDispatch(commentEvent(), commentSettings);
  assert.equal(dispatch.issueNumber, 93);
  assert.equal(dispatch.sessionScope, 'pr-test');
  assert.match(dispatch.message, /Do not edit code/);
  assert.match(dispatch.message, /exactly one pull-request comment/);
});

test('a test request needs no assignee but must be a pull request', () => {
  // The whole point is commenting on a pushed branch, so an unassigned PR is
  // the normal case; routing comes from the commenter instead.
  assert.equal(
    buildDispatch(commentEvent({ issue: { assignees: [] } }), commentSettings)
      .issueNumber,
    93,
  );
  assert.match(
    buildDispatch(
      commentEvent({ issue: { pull_request: undefined } }),
      commentSettings,
    ).ignored,
    /only to a pull request/,
  );
});

test('comment commands route by commenter, not by assignee', () => {
  const otherHost = { ...commentSettings, AGENT_OWNER_LOGIN: 'DolevSeren' };
  // Allowlisted, but this is not Dolev's host to answer.
  assert.match(
    buildDispatch(commentEvent(), otherHost).ignored,
    /not addressed to DolevSeren's host/,
  );
  assert.match(
    buildDispatch(
      commentEvent({ sender: { login: 'outsider' } }),
      commentSettings,
    ).ignored,
    /not allowlisted/,
  );
});

test('openclaw work starts implementation only on an assigned issue', () => {
  const asIssue = (assignees) =>
    commentEvent({
      comment: { body: 'openclaw work' },
      issue: { number: 75, pull_request: undefined, assignees },
    });

  const dispatch = buildDispatch(
    asIssue([{ login: 'SaharBarak' }]),
    commentSettings,
  );
  assert.equal(dispatch.issueNumber, 75);
  assert.equal(dispatch.sessionScope, undefined);
  assert.match(dispatch.message, /only implementation dispatch signal/);

  assert.match(buildDispatch(asIssue([]), commentSettings).ignored, /assigned/);
  assert.match(
    buildDispatch(
      commentEvent({ comment: { body: 'openclaw work' } }),
      commentSettings,
    ).ignored,
    /only to an issue/,
  );
});

test('an ordinary comment never reaches the agent', () => {
  assert.match(
    buildDispatch(
      commentEvent({ comment: { body: 'looks good to me' } }),
      commentSettings,
    ).ignored,
    /not an OpenClaw command/,
  );
  assert.match(
    buildDispatch(
      commentEvent({ comment: { body: 'openclaw deploy' } }),
      commentSettings,
    ).ignored,
    /unknown OpenClaw command deploy/,
  );
});
