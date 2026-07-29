#!/usr/bin/env node

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export function inspectEvidence({ branch, root = process.cwd() }) {
  const match = String(branch).match(/^agent\/issue-(\d+)(?:-|$)/);
  if (!match) {
    return { required: false, valid: true, errors: [] };
  }

  const issueNumber = match[1];
  const evidenceDir = join(
    root,
    'docs',
    'agent-evidence',
    `issue-${issueNumber}`,
  );
  const readmePath = join(evidenceDir, 'README.md');
  const errors = [];

  if (!existsSync(readmePath)) {
    errors.push(`Missing evidence report: ${readmePath}`);
    return { required: true, valid: false, issueNumber, errors };
  }

  const readme = readFileSync(readmePath, 'utf8');
  if (readme.trim().length < 120) {
    errors.push('Evidence README must summarize checks and acceptance criteria.');
  }

  const files = readdirSync(evidenceDir);
  const images = files.filter((file) => /\.(png|jpe?g|webp)$/i.test(file));
  const notApplicable =
    /Visual evidence:\s*Not applicable\s*[—-]\s*\S+/i.test(readme);

  if (images.length === 0 && !notApplicable) {
    errors.push(
      'Add at least one screenshot or a specific "Visual evidence: Not applicable — reason" statement.',
    );
  }
  if (images.length > 4) {
    errors.push('Keep evidence focused: no more than four screenshots per issue.');
  }
  for (const image of images) {
    const bytes = statSync(join(evidenceDir, image)).size;
    if (bytes > 1_500_000) {
      errors.push(`${image} exceeds the 1.5 MB evidence limit.`);
    }
  }

  return {
    required: true,
    valid: errors.length === 0,
    issueNumber,
    readmePath,
    images,
    errors,
  };
}

function currentBranch() {
  if (process.env.GITHUB_HEAD_REF) {
    return process.env.GITHUB_HEAD_REF;
  }
  return execFileSync('git', ['branch', '--show-current'], {
    encoding: 'utf8',
  }).trim();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = inspectEvidence({ branch: currentBranch() });
  if (!result.valid) {
    for (const error of result.errors) {
      process.stderr.write(`- ${error}\n`);
    }
    process.exitCode = 2;
  } else if (result.required) {
    process.stdout.write(
      `Evidence for issue #${result.issueNumber}: ${
        result.images.length
      } image(s).\n`,
    );
  } else {
    process.stdout.write('Evidence check is not required for this branch.\n');
  }
}
