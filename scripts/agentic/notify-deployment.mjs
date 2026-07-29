#!/usr/bin/env node

import { parseArgs, runGh } from './lib.mjs';
import { sendTelegramMessage } from './telegram.mjs';

const MARKER = '<!-- taruu-agent-deployment -->';

function linkedIssue(pr) {
  const branchMatch = String(pr.head?.ref ?? '').match(
    /^agent\/issue-(\d+)(?:-|$)/,
  );
  if (branchMatch) return Number(branchMatch[1]);

  const closingMatch = String(pr.body ?? '').match(
    /\b(?:close[sd]?|fixe?[sd]?|resolve[sd]?)\s+#(\d+)\b/i,
  );
  return Number(closingMatch?.[1]) || undefined;
}

function upsertComment(repository, issueNumber, body) {
  const comments = JSON.parse(
    runGh([
      'api',
      `repos/${repository}/issues/${issueNumber}/comments`,
      '--paginate',
    ]),
  );
  const existing = comments.find((comment) =>
    String(comment.body).includes(MARKER),
  );

  if (existing) {
    runGh([
      'api',
      '--method',
      'PATCH',
      `repos/${repository}/issues/comments/${existing.id}`,
      '-f',
      `body=${body}`,
    ]);
  } else {
    runGh([
      'api',
      '--method',
      'POST',
      `repos/${repository}/issues/${issueNumber}/comments`,
      '-f',
      `body=${body}`,
    ]);
  }
}

const args = parseArgs(process.argv.slice(2));
const repository = args.repository ?? process.env.GITHUB_REPOSITORY;
const sha = args.sha ?? process.env.GITHUB_SHA;
const outcome = String(args.outcome ?? '').toLowerCase();
const runUrl =
  args['run-url'] ??
  `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const productionUrl = args.url ?? 'https://taruu.co.il';

if (!repository || !sha || !['success', 'failure', 'cancelled'].includes(outcome)) {
  process.stderr.write(
    'Usage: notify-deployment.mjs --repository owner/name --sha SHA --outcome success|failure|cancelled\n',
  );
  process.exit(2);
}

const pullRequests = JSON.parse(
  runGh([
    'api',
    `repos/${repository}/commits/${sha}/pulls`,
    '-H',
    'Accept: application/vnd.github+json',
  ]),
);
const pr = pullRequests.find((candidate) => candidate.merged_at) ?? pullRequests[0];
if (!pr) {
  process.stdout.write('No pull request is associated with this deployment.\n');
  process.exit(0);
}

const issueNumber = linkedIssue(pr);
const success = outcome === 'success';
const message = [
  MARKER,
  success
    ? `✅ Production deployment succeeded for ${sha.slice(0, 7)}.`
    : `❌ Production deployment ${outcome} for ${sha.slice(0, 7)}.`,
  '',
  success ? `[Open production](${productionUrl})` : null,
  `[View deployment run](${runUrl})`,
].filter(Boolean).join('\n');

upsertComment(repository, pr.number, message);

if (issueNumber) {
  upsertComment(repository, issueNumber, message);
  const labelArgs = [
    'issue',
    'edit',
    String(issueNumber),
    '--repo',
    repository,
  ];
  if (success) {
    labelArgs.push(
      '--add-label',
      'agent:deployed',
      '--remove-label',
      'agent:deploy-failed',
    );
  } else {
    labelArgs.push(
      '--add-label',
      'agent:deploy-failed',
      '--remove-label',
      'agent:deployed',
    );
  }
  runGh(labelArgs);
}

try {
  await sendTelegramMessage({
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    text: [
      success
        ? `✅ Taruu עלה לפרודקשן בהצלחה (PR #${pr.number}).`
        : `❌ פריסת Taruu הסתיימה בסטטוס ${outcome} (PR #${pr.number}).`,
      issueNumber ? `Issue #${issueNumber}` : null,
      success ? productionUrl : null,
      runUrl,
    ]
      .filter(Boolean)
      .join('\n'),
  });
} catch (error) {
  process.stderr.write(`${error.message}\n`);
}

process.stdout.write(
  `Deployment notification updated for PR #${pr.number}${
    issueNumber ? ` and issue #${issueNumber}` : ''
  }.\n`,
);
