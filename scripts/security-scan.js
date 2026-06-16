/**
 * security-scan.js — pre-start malicious-code guard.
 * ---------------------------------------------------------------------------
 * Statically scans the project's source for high-confidence signs of injected
 * malware / trojans / backdoors before the server is allowed to boot:
 *   - dynamic code execution (eval, Function constructor, vm)
 *   - shell / process spawning with dynamic input (child_process)
 *   - obfuscated payloads (base64 -> Buffer/atob -> eval, long hex blobs)
 *   - reverse shells / hardcoded external exfiltration endpoints
 *   - tampering with globals (global.* / globalThis.* assignment, prototype pollution)
 *   - secret/env exfiltration patterns
 *   - destructive filesystem commands (rm -rf /, etc.)
 *   - crypto-miner / known-bad package signatures
 *
 * Findings are CRITICAL (block boot) or WARN (report, don't block).
 * Exit 0 = safe to start, Exit 1 = critical finding (boot blocked).
 *
 * Scans: src/, scripts/  (skips node_modules, dist, .next, migrations/_archive).
 * Usage:
 *   node scripts/security-scan.js            # scan, exit 1 on CRITICAL
 *   node scripts/security-scan.js --warn-only  # never block (report only)
 *   SECURITY_SCAN_DISABLE=1                   # skip entirely (not recommended)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['src', 'scripts'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.git', '_archive', 'coverage']);
const EXAs = new Set(['.ts', '.js', '.mjs', '.cjs', '.tsx', '.jsx']);
// These first-party scanner files legitimately contain the very patterns the
// rules look for — they ARE the signature definitions, not malicious code.
// (scan-malware.js carries the dynamic-execution signatures as string
// literals.) Exclude them from scanning.
const ALLOWLIST = new Set([
  path.relative(ROOT, __filename),
  path.join('scripts', 'scan-malware.js'),
]);

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/** @type {{id:string,sev:'CRITICAL'|'WARN',re:RegExp,desc:string}[]} */
const RULES = [
  // ── Dynamic code execution ───────────────────────────────────────────────
  { id: 'eval', sev: 'CRITICAL', re: /\beval\s*\(/, desc: 'eval() — arbitrary code execution' },
  { id: 'function-ctor', sev: 'CRITICAL', re: /\bnew\s+Function\s*\(/, desc: 'Function constructor — dynamic code execution' },
  { id: 'vm-run', sev: 'CRITICAL', re: /\brequire\(\s*['"]vm['"]\s*\)|vm\.runIn(New)?Context|\bvm2\b/, desc: 'vm/vm2 sandbox code execution' },
  { id: 'settimeout-string', sev: 'CRITICAL', re: /\bset(Timeout|Interval)\s*\(\s*['"`]/, desc: 'setTimeout/Interval with a string body (eval-like)' },

  // ── Shell / process spawning ─────────────────────────────────────────────
  { id: 'child_process', sev: 'CRITICAL', re: /require\(\s*['"]child_process['"]\s*\)|from\s+['"]child_process['"]/, desc: 'child_process import — shell access' },
  // Only flag a shell command built from an interpolated template — e.g. exec(`rm ${x}`).
  // (RegExp.prototype.exec(str) does NOT match this; the child_process import above is the
  // real gate for shell access.)
  { id: 'exec-dynamic', sev: 'CRITICAL', re: /\b(exec|execSync|spawn|spawnSync|execFile)\s*\(\s*`[^`]*\$\{/, desc: 'exec/spawn with an interpolated shell command' },

  // ── Obfuscation / encoded payloads ───────────────────────────────────────
  { id: 'b64-eval', sev: 'CRITICAL', re: /(atob|Buffer\.from)\s*\([^)]*['"]base64['"][^)]*\)[^;]{0,40}(eval|Function)/, desc: 'base64-decoded payload passed to eval/Function' },
  { id: 'atob-exec', sev: 'CRITICAL', re: /\batob\s*\([^)]*\)\s*\)?\s*(\(|;?\s*eval)/, desc: 'atob() output executed' },
  { id: 'hex-blob', sev: 'WARN', re: /['"](?:\\x[0-9a-fA-F]{2}){12,}['"]/, desc: 'long \\xNN-escaped string (possible obfuscated payload)' },
  { id: 'long-b64', sev: 'WARN', re: /['"][A-Za-z0-9+/]{160,}={0,2}['"]/, desc: 'very long base64 literal (possible embedded payload)' },

  // ── Reverse shells / exfiltration ────────────────────────────────────────
  { id: 'reverse-shell', sev: 'CRITICAL', re: /\/dev\/tcp\/|bash\s+-i\s+>&|nc\s+-e\b|socket\.connect\([^)]*shell|\brev(erse)?_?shell\b/i, desc: 'reverse-shell signature' },
  { id: 'hardcoded-ip-url', sev: 'WARN', re: /https?:\/\/\d{1,3}(\.\d{1,3}){3}(:\d+)?/, desc: 'hardcoded http(s) URL to a raw IP (possible C2/exfil)' },
  { id: 'env-exfil', sev: 'CRITICAL', re: /(fetch|axios|https?\.request|got|node-fetch)[^;]{0,80}(process\.env|JSON\.stringify\(\s*process\.env)/, desc: 'sending process.env over the network (secret exfiltration)' },

  // ── Global / prototype tampering ─────────────────────────────────────────
  { id: 'global-assign', sev: 'WARN', re: /\b(global|globalThis)\s*\.\s*[A-Za-z_$][\w$]*\s*=/, desc: 'assignment to a global property' },
  { id: 'proto-pollution', sev: 'WARN', re: /\[\s*['"]__proto__['"]\s*\]\s*=|\.\s*prototype\s*\[\s*[a-zA-Z_$]/, desc: 'possible prototype pollution' },
  { id: 'module-override', sev: 'WARN', re: /require\.cache\s*\[|Module\.prototype\.(require|_compile)\s*=/, desc: 'tampering with the module loader' },

  // ── Destructive / dangerous filesystem ───────────────────────────────────
  { id: 'rm-rf', sev: 'CRITICAL', re: /rm\s+-rf\s+(\/(?!home|tmp\b)|~|\$HOME)|rimraf\s*\(\s*['"]\//, desc: 'destructive recursive delete of a system path' },
  { id: 'crypto-miner', sev: 'CRITICAL', re: /\b(coinhive|cryptonight|stratum\+tcp|xmrig|minerd)\b/i, desc: 'crypto-miner signature' },

  // ── Dynamic require of attacker-controlled input ─────────────────────────
  { id: 'dynamic-require', sev: 'WARN', re: /\brequire\(\s*[a-zA-Z_$][\w$.]*\s*\)|\bimport\(\s*[a-zA-Z_$][\w$.]*\s*\)/, desc: 'require()/import() of a non-literal (dynamic module load)' },
];

function listFiles(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      listFiles(path.join(dir, e.name), out);
    } else if (EXAs.has(path.extname(e.name))) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function scanFile(file, findings) {
  const rel = path.relative(ROOT, file);
  if (ALLOWLIST.has(rel)) return; // don't flag the scanner/signature files themselves
  let lines;
  try {
    lines = fs.readFileSync(file, 'utf8').split('\n');
  } catch {
    return;
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // skip obvious comment-only lines to cut noise (best-effort)
    const trimmed = line.trim();
    const isComment = trimmed.startsWith('//') || trimmed.startsWith('*');
    const isTestFile = /\.spec\.|\.test\./.test(rel);
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        // De-noise: ignore WARN-level matches inside comments
        if (rule.sev === 'WARN' && isComment) continue;
        // Allowlist: loopback/private IPs are not exfiltration endpoints
        if (rule.id === 'hardcoded-ip-url') {
          const ip = (line.match(/\d{1,3}(?:\.\d{1,3}){3}/) || [''])[0];
          if (/^(127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) continue;
        }
        // Allowlist: assigning global.fetch / globals inside test files is normal mocking
        if (rule.id === 'global-assign' && isTestFile) continue;
        findings.push({
          rule,
          file: rel,
          line: i + 1,
          text: trimmed.slice(0, 140),
        });
      }
    }
  }
}

function main() {
  if (process.env.SECURITY_SCAN_DISABLE === '1') {
    console.log(C.yellow('[security-scan] DISABLED via SECURITY_SCAN_DISABLE=1 — skipping.'));
    process.exit(0);
  }
  const warnOnly = process.argv.includes('--warn-only');

  const files = [];
  for (const d of SCAN_DIRS) listFiles(path.join(ROOT, d), files);

  const findings = [];
  for (const f of files) scanFile(f, findings);

  const critical = findings.filter((f) => f.rule.sev === 'CRITICAL');
  const warns = findings.filter((f) => f.rule.sev === 'WARN');

  console.log(C.bold(`\n[security-scan] scanned ${files.length} source files`));

  if (!findings.length) {
    console.log(C.green('  ✓ no suspicious patterns found — safe to start.\n'));
    process.exit(0);
  }

  const print = (f) => {
    const tag = f.rule.sev === 'CRITICAL' ? C.red('CRITICAL') : C.yellow('WARN  ');
    console.log(`  ${tag} ${C.bold(f.rule.id)} — ${f.rule.desc}`);
    console.log(C.dim(`        ${f.file}:${f.line}  ${f.text}`));
  };

  if (critical.length) {
    console.log(C.red(`\n  ${critical.length} CRITICAL finding(s):`));
    critical.forEach(print);
  }
  if (warns.length) {
    console.log(C.yellow(`\n  ${warns.length} warning(s):`));
    warns.forEach(print);
  }

  if (critical.length && !warnOnly) {
    console.log(
      C.red(
        `\n  ✗ BLOCKED: ${critical.length} critical finding(s). Server start aborted.\n` +
          C.dim(
            '    Review the lines above. If a finding is a legitimate false positive, ' +
            'refactor it or run with --warn-only / SECURITY_SCAN_DISABLE=1 to override.\n',
          ),
      ),
    );
    process.exit(1);
  }

  console.log(C.yellow('\n  ⚠ warnings only — start permitted.\n'));
  process.exit(0);
}

main();
