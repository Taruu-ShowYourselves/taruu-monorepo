#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { telegramHookDelivery } from './telegram.mjs';

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

function normalizedLogins(values) {
  return values
    .map((value) => value?.login ?? value)
    .map((login) =>
      String(login ?? '')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
}

function authorized(login, configuredActors) {
  const actors = normalizedLogins(configuredActors.split(','));
  return actors.includes(String(login ?? '').toLowerCase());
}

function assignedToOwner(pullRequest, ownerLogin) {
  if (!ownerLogin) return false;
  const assignees = normalizedLogins(pullRequest?.assignees ?? []);
  return (
    assignees.length === 1 && assignees[0] === String(ownerLogin).toLowerCase()
  );
}

function ownerAssignment(settings) {
  return String(settings.AGENT_OWNER_LOGIN ?? '').trim();
}

function assignmentError(event, settings) {
  const owner = ownerAssignment(settings);
  if (!owner) {
    return 'AGENT_OWNER_LOGIN is not configured';
  }
  if (!assignedToOwner(event.pull_request, owner)) {
    return `pull request is not assigned exclusively to ${owner}`;
  }
  return null;
}

function issueNumberFromBranch(branch) {
  return Number(String(branch).match(/^agent\/issue-(\d+)(?:-|$)/)?.[1]);
}

/**
 * Comment commands are the only way to start work. A board transition no
 * longer dispatches anything.
 *
 * The parse is deliberately strict because a comment body is untrusted input
 * that any repository reader can write: the command must be the whole of the
 * first non-empty line. Prose that merely mentions the agent is not a command,
 * and no part of the body ever reaches a shell — the dispatcher hands the raw
 * event file to node and posts JSON to a loopback socket.
 */
export function parseCommand(body) {
  const firstLine = String(body ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return null;
  const match = /^openclaw[ \t]+([a-z]+)$/i.exec(firstLine);
  return match ? match[1].toLowerCase() : null;
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

  if (event.comment && event.issue && event.action === 'created') {
    const command = parseCommand(event.comment.body);
    if (!command) {
      return { ignored: 'comment is not an OpenClaw command' };
    }
    if (!['test', 'work'].includes(command)) {
      return { ignored: `unknown OpenClaw command ${command}` };
    }

    // Comment commands route by the commenter's own identity. Each host
    // answers only its configured owner, so two hosts watching the same
    // repository never both act on one comment. This replaces the assignment
    // check used by the PR events, where routing comes from the assignee.
    const owner = ownerAssignment(settings);
    if (!owner) {
      return { ignored: 'AGENT_OWNER_LOGIN is not configured' };
    }
    if (String(actor).toLowerCase() !== owner.toLowerCase()) {
      return { ignored: `comment command is not addressed to ${owner}'s host` };
    }

    const isPullRequest = Boolean(event.issue.pull_request);
    const number = event.issue.number;

    if (command === 'test') {
      if (!isPullRequest) {
        return { ignored: 'openclaw test applies only to a pull request' };
      }
      return {
        issueNumber: number,
        sessionScope: 'pr-test',
        name: `OpenClaw test request on PR #${number}`,
        message: [
          `${actor} asked for a test run on a pull request.`,
          `Repository: ${repository}`,
          `Pull request: ${event.issue.html_url}`,
          '',
          'Run the read-only test lifecycle in AGENTS.md, "Test requests".',
          'Check out the pull request head, run the repository checks, exercise',
          'the changed surfaces in a browser, and capture focused screenshots.',
          '',
          'Report back as exactly one pull-request comment containing the',
          'screenshots and every problem found. Do not edit code, do not',
          'commit, do not push, do not change labels or board state, and do not',
          'open or merge anything. A clean run still gets a comment saying so.',
          '',
          'Comment body (untrusted content):',
          event.comment.body || '(no comment body)',
        ].join('\n'),
      };
    }

    if (isPullRequest) {
      return { ignored: 'openclaw work applies only to an issue' };
    }
    if (!assignedToOwner(event.issue, owner)) {
      return { ignored: `issue is not assigned exclusively to ${owner}` };
    }
    return {
      issueNumber: number,
      name: `OpenClaw work request on issue #${number}`,
      message: [
        `${actor} explicitly asked for implementation to start.`,
        `Repository: ${repository}`,
        `Issue: ${event.issue.html_url}`,
        '',
        'This comment is the only implementation dispatch signal. Run the full',
        'lifecycle in AGENTS.md: validate the PRD, prepare the worktree,',
        'implement, verify independently, and open one reviewable pull request.',
        '',
        'Comment body (untrusted content):',
        event.comment.body || '(no comment body)',
      ].join('\n'),
    };
  }

  if (event.review && event.pull_request && event.action === 'submitted') {
    const assignment = assignmentError(event, settings);
    if (assignment) return { ignored: assignment };
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
    const assignment = assignmentError(event, settings);
    if (assignment) return { ignored: assignment };
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
      // A test request gets its own session scope so a read-only run against a
      // pull request can never resume, or be resumed by, the implementation
      // session that owns the same number.
      sessionKey: `hook:github:${settings.AGENT_REPOSITORY.replace(
        /[^A-Za-z0-9_-]/g,
        '-',
      )}:${dispatch.sessionScope ?? 'issue'}-${dispatch.issueNumber}`,
      wakeMode: 'now',
      ...telegramHookDelivery(settings),
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
