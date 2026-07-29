#!/usr/bin/env node

import { parseArgs, setProjectStatus } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const required = [
  'repository',
  'issue',
  'project-owner',
  'project-number',
  'status',
];
const missing = required.filter((key) => !args[key]);

if (missing.length > 0) {
  process.stderr.write(`Missing arguments: ${missing.join(', ')}\n`);
  process.exit(2);
}

const result = await setProjectStatus({
  repository: args.repository,
  issueNumber: Number(args.issue),
  projectOwner: args['project-owner'],
  projectNumber: Number(args['project-number']),
  status: args.status,
  assignee: args.assignee,
  addLabels: String(args['add-labels'] ?? '')
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean),
  removeLabels: String(args['remove-labels'] ?? '')
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean),
});

process.stdout.write(`${JSON.stringify(result)}\n`);
