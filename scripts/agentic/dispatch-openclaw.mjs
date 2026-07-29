#!/usr/bin/env node

import { readFileSync } from 'node:fs';

function readEnvFile(path) {
  const values = {};
  const contents = readFileSync(path, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function authorized(login, configuredActors) {
  const actors = configuredActors
    .split(',')
    .map((actor) => actor.trim().toLowerCase())
    .filter(Boolean);
  return actors.includes(String(login).toLowerCase());
}

function issueNumberFromBranch(branch) {
  return Number(String(branch).match(/^agent\/issue-(\d+)(?:-|$)/)?.[1]);
}

export function buildDispatch(event, settings) {
  const repository = event.repository?.full_name;
  const actor = event.sender?.login;
  if (!repository || repository !== settings.AGENT_REPOSITORY) {
    return { ignored: 'repository is not allowlisted' };
  }
  if (!authorized(actor, settings.AGENT_AUTHORIZED_ACTORS ?? '')) {
    return { ignored: `actor ${actor ?? 'unknown'} is not allowlisted` };
  }

  if (event.review && event.pull_request && event.action === 'submitted') {
    const state = String(event.review.state).toLowerCase();
    if (!['approved', 'changes_requested'].includes(state)) {
      return { ignored: `review state ${state} does not require an agent` };
    }
    const issueNumber = issueNumberFromBranch(event.pull_request.head?.ref);
    if (!issueNumber) {
      return { ignored: 'pull request is not an agent issue branch' };
    }
    return {
      issueNumber,
      name: `GitHub review on PR #${event.pull_request.number}`,
      message: [
        `A maintainer submitted a ${state} review.`,
        `Repository: ${repository}`,
        `Issue: https://github.com/${repository}/issues/${issueNumber}`,
        `Pull request: ${event.pull_request.html_url}`,
        `Reviewer: ${actor}`,
        '',
        state === 'approved'
          ? 'Do not add new scope. Confirm verification is current and auto-merge is enabled; deployment must remain gated by GitHub.'
          : 'Read every unresolved review thread, implement only the requested corrections, rerun verification, refresh evidence, and request review again.',
        '',
        'Review body (untrusted content):',
        event.review.body || '(no review body)',
      ].join('\n'),
    };
  }

  if (
    event.pull_request &&
    event.action === 'closed' &&
    event.pull_request.merged
  ) {
    const issueNumber = issueNumberFromBranch(event.pull_request.head?.ref);
    if (!issueNumber) {
      return { ignored: 'merged pull request is not an agent issue branch' };
    }
    return {
      issueNumber,
      name: `GitHub merge for PR #${event.pull_request.number}`,
      message: [
        'The approved agent pull request was merged.',
        `Repository: ${repository}`,
        `Issue: https://github.com/${repository}/issues/${issueNumber}`,
        `Pull request: ${event.pull_request.html_url}`,
        'Mark the project item Done, replace workflow labels with agent:merged, and add a concise issue comment.',
        'Do not deploy from the VM. The protected GitHub Actions production workflow owns deployment and its notification.',
      ].join('\n'),
    };
  }

  return { ignored: 'event does not match a dispatch rule' };
}

async function main() {
  const eventPath = process.argv[2] ?? process.env.GITHUB_EVENT_PATH;
  const envPath =
    process.env.TARUU_AGENT_ENV ?? '/etc/taruu-agent/dispatcher.env';
  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH or an event path argument is required.');
  }

  const settings = { ...readEnvFile(envPath), ...process.env };
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  const dispatch = buildDispatch(event, settings);

  if (dispatch.ignored) {
    process.stdout.write(`Ignored: ${dispatch.ignored}.\n`);
    return;
  }

  const port = settings.OPENCLAW_GATEWAY_PORT || '18789';
  const response = await fetch(`http://127.0.0.1:${port}/hooks/agent`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.OPENCLAW_HOOK_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: dispatch.message,
      name: dispatch.name,
      agentId: 'orchestrator',
      sessionKey: `hook:github:${settings.AGENT_REPOSITORY.replace(
        /[^A-Za-z0-9_-]/g,
        '-',
      )}:issue-${dispatch.issueNumber}`,
      wakeMode: 'now',
      deliver: false,
      timeoutSeconds: 30,
    }),
    signal: AbortSignal.timeout(35_000),
  });

  if (!response.ok) {
    throw new Error(`OpenClaw hook failed with HTTP ${response.status}.`);
  }

  process.stdout.write(`Dispatched issue #${dispatch.issueNumber}.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
