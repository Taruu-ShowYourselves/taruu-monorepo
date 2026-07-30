import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { inspectEvidence } from '../check-evidence.mjs';
import { buildDispatch } from '../dispatch-openclaw.mjs';
import { extractPrdSections, validatePrd } from '../lib.mjs';
import { branchSlug } from '../prepare-worktree.mjs';
import {
  classifyProjectTransition,
  findInProgressTransitions,
} from '../watch-project.mjs';
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

test('project watcher detects only transitions into In Progress', () => {
  const previous = {
    item1: { status: 'Todo' },
    item2: { status: 'In Progress' },
  };
  const transitions = findInProgressTransitions(previous, [
    { id: 'item1', status: 'In Progress' },
    { id: 'item2', status: 'In Progress' },
    { id: 'item3', status: 'Done' },
  ]);
  assert.deepEqual(
    transitions.map((item) => item.id),
    ['item1'],
  );
});

test('project watcher requires an authorized manual move and a full PRD', () => {
  const settings = {
    AGENT_REPOSITORY: 'Taruu-ShowYourselves/taruu-monorepo',
    AGENT_PROJECT_NUMBER: '2',
    AGENT_AUTHORIZED_ACTORS: 'SaharBarak,DolevSeren',
    AGENT_OWNER_LOGIN: 'DolevSeren',
  };
  const item = {
    number: 99,
    title: 'Record votes',
    body: completePrd,
    url: 'https://github.com/example/repo/issues/99',
    repository: settings.AGENT_REPOSITORY,
    state: 'OPEN',
    assignees: ['DolevSeren'],
  };
  const event = {
    actor: 'SaharBarak',
    projectNumber: 2,
    status: 'In Progress',
    wasAutomated: false,
  };
  const dispatch = classifyProjectTransition(item, event, settings);
  assert.match(dispatch.message, /sole implementation dispatch signal/);

  const automated = classifyProjectTransition(
    item,
    { ...event, wasAutomated: true },
    settings,
  );
  assert.match(automated.ignored, /automated/);

  const unauthorized = classifyProjectTransition(
    item,
    { ...event, actor: 'outsider' },
    settings,
  );
  assert.match(unauthorized.ignored, /not allowlisted/);

  const incomplete = classifyProjectTransition(
    {
      ...item,
      body: '## Problem\nNot a full PRD.',
    },
    event,
    settings,
  );
  assert.equal(incomplete.invalidPrd, true);
});

test('Dolev watcher dispatches a Dolev-assigned issue case-insensitively', () => {
  const settings = {
    AGENT_REPOSITORY: 'Taruu-ShowYourselves/taruu-monorepo',
    AGENT_PROJECT_NUMBER: '2',
    AGENT_AUTHORIZED_ACTORS: 'SaharBarak,DolevSeren',
    AGENT_OWNER_LOGIN: 'dolevseren',
  };
  const dispatch = classifyProjectTransition(
    {
      number: 99,
      title: 'Record votes',
      body: completePrd,
      url: 'https://github.com/example/repo/issues/99',
      repository: settings.AGENT_REPOSITORY,
      state: 'OPEN',
      assignees: ['DOLEVSEREN'],
    },
    {
      actor: 'saharbarak',
      projectNumber: 2,
      status: 'In Progress',
      wasAutomated: false,
    },
    settings,
  );
  assert.match(dispatch.message, /sole implementation dispatch signal/);
});

test('Dolev watcher ignores Sahar-assigned and unassigned issues', () => {
  const settings = {
    AGENT_REPOSITORY: 'Taruu-ShowYourselves/taruu-monorepo',
    AGENT_PROJECT_NUMBER: '2',
    AGENT_AUTHORIZED_ACTORS: 'SaharBarak,DolevSeren',
    AGENT_OWNER_LOGIN: 'DolevSeren',
  };
  const baseItem = {
    number: 99,
    title: 'Record votes',
    body: completePrd,
    url: 'https://github.com/example/repo/issues/99',
    repository: settings.AGENT_REPOSITORY,
    state: 'OPEN',
  };
  const event = {
    actor: 'SaharBarak',
    projectNumber: 2,
    status: 'In Progress',
    wasAutomated: false,
  };
  assert.match(
    classifyProjectTransition(
      { ...baseItem, assignees: ['SaharBarak'] },
      event,
      settings,
    ).ignored,
    /not assigned/,
  );
  assert.match(
    classifyProjectTransition({ ...baseItem, assignees: [] }, event, settings)
      .ignored,
    /not assigned/,
  );
});

test('first-install baseline has no In Progress transitions', () => {
  const currentItems = [
    { id: 'item1', status: 'In Progress' },
    { id: 'item2', status: 'Todo' },
  ];
  const baseline = Object.fromEntries(
    currentItems.map((item) => [item.id, { status: item.status }]),
  );
  assert.deepEqual(findInProgressTransitions(baseline, currentItems), []);
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
