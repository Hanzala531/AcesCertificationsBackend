#!/usr/bin/env node
/**
 * guard-install.js — blocks raw `npm install` / `npm i` / `npm ci`.
 *
 * Wired as the project's `preinstall` hook. npm runs `preinstall` for a normal
 * install BUT skips it (and every other lifecycle script) when invoked with
 * `--ignore-scripts`. The safe entrypoint — `npm run initialize` — installs
 * with `--ignore-scripts`, so this guard is bypassed there by design and only
 * ever fires on the unsafe, script-executing path we want to stop.
 *
 * Escape hatch (discouraged): ACES_ALLOW_RAW_INSTALL=1 npm install
 */
'use strict';

if (process.env.ACES_ALLOW_RAW_INSTALL === '1') process.exit(0);

// Allow automated/CI environments (Vercel, GitHub Actions, etc.) to install
// normally. This guard exists to stop unsafe *local* installs that execute
// dependency scripts — it must not block deploys, where the platform controls
// the install step. Vercel sets VERCEL=1; most CI sets CI=true.
if (process.env.VERCEL || process.env.CI || process.env.NOW_BUILDER) {
  process.exit(0);
}

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

console.error(
  '\n' +
  C.red(C.bold('  ✗ Direct `npm install` / `npm i` / `npm ci` is disabled for this project.')) +
  '\n\n' +
  '  Dependency install-scripts are the main way supply-chain malware executes,\n' +
  '  so raw installs are blocked. Use the guarded command instead:\n\n' +
  '      ' + C.cyan(C.bold('npm run initialize')) + '\n\n' +
  '  It installs with --ignore-scripts (no dependency scripts run), then scans the\n' +
  '  tree for injected/malicious code, then rebuilds trusted native modules.\n\n' +
  C.dim('  Escape hatch (NOT recommended): ACES_ALLOW_RAW_INSTALL=1 npm install') +
  '\n',
);

process.exit(1);
