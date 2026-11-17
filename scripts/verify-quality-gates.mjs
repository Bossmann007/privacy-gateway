#!/usr/bin/env node
// Measure max-file-lines without auto-fixing. Exit 0 always in measure mode.

import { execSync } from 'node:child_process';

const max = process.env.MAX_LINES || '350';
process.env.MAX_LINES = max;

try {
  const out = execSync('npx eslint . --max-warnings 999999', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  console.log(out);
  console.log(`[cursor-kit] measure-only complete (MAX_LINES=${max})`);
} catch (err) {
  const stdout = err.stdout?.toString?.() || '';
  const stderr = err.stderr?.toString?.() || '';
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  console.log(`[cursor-kit] measure-only finished with eslint exit ${err.status} (MAX_LINES=${max})`);
  process.exit(0);
}
