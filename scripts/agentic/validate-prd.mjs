#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { parseArgs, validatePrd } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const markdown = args.file
  ? readFileSync(args.file, 'utf8')
  : readFileSync(0, 'utf8');
const result = validatePrd(markdown);

if (args.json) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else if (result.valid) {
  process.stdout.write('PRD is valid.\n');
} else {
  for (const error of result.errors) {
    process.stderr.write(`- ${error}\n`);
  }
}

process.exitCode = result.valid ? 0 : 2;
