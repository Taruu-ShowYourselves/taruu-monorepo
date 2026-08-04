#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { parseArgs, runGh, setProjectStatus, validatePrd } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const title = args.title;
const bodyFile = args['body-file'];
const repository =
  args.repository ??
  process.env.AGENT_REPOSITORY ??
  'Taruu-ShowYourselves/taruu-monorepo';
const projectOwner =
  args['project-owner'] ??
  process.env.AGENT_PROJECT_OWNER ??
  'Taruu-ShowYourselves';
const projectNumber = Number(
  args['project-number'] ?? process.env.AGENT_PROJECT_NUMBER ?? 2,
);

if (!title || !bodyFile) {
  process.stderr.write(
    'Usage: create-issue.mjs --title <title> --body-file <path>\n',
  );
  process.exit(2);
}

const body = readFileSync(bodyFile, 'utf8');
const validation = validatePrd(body);
if (!validation.valid) {
  process.stderr.write('PRD validation failed:\n');
  for (const error of validation.errors) {
    process.stderr.write(`- ${error}\n`);
  }
  process.exit(2);
}

runGh([
  'label',
  'create',
  'agents',
  '--repo',
  repository,
  '--color',
  '5319e7',
  '--description',
  'Work handled by the delivery agent workflow',
  '--force',
]);
const issueUrl = runGh([
  'issue',
  'create',
  '--repo',
  repository,
  '--title',
  title,
  '--body-file',
  bodyFile,
  '--label',
  'agents',
]);
const issueNumber = Number(issueUrl.match(/\/issues\/(\d+)$/)?.[1]);
if (!issueNumber) {
  throw new Error(`Could not determine issue number from ${issueUrl}.`);
}

try {
  await setProjectStatus({
    repository,
    issueNumber,
    projectOwner,
    projectNumber,
    status: 'Todo',
  });
} catch (error) {
  runGh([
    'issue',
    'comment',
    issueUrl,
    '--body',
    `Agent dispatch was not enabled because project setup failed:\n\n\`${String(
      error.message,
    ).replace(/`/g, "'")}\``,
  ]);
  throw error;
}

process.stdout.write(
  `${issueUrl}\nAdded to Project #${projectNumber} as Todo. Nothing starts on its own: assign the issue to yourself and comment "openclaw work" on it when OpenClaw should begin.\n`,
);
