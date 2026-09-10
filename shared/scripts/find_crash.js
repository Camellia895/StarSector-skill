// Find crash-relevant entries in a (possibly huge, GBK-encoded, multi-session) starsector.log.
//  - splits the log into sessions by millisecond-timestamp resets
//  - prints session boundaries, then per-session ERROR/Exception/Caused-by lines
//  - dumps context around the LAST session's first fatal error (default) or --all sessions
// Usage: node find_crash.js <starsector.log> [--all]
'use strict';
const fs = require('fs');

const logPath = process.argv[2];
const all = process.argv.includes('--all');
if (!logPath) { console.error('usage: node find_crash.js <starsector.log> [--all]'); process.exit(1); }
const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/);

// session boundaries: line i (1-based) where timestamp decreased vs previous line
const resets = [];
for (let i = 1; i < lines.length; i++) {
  const m1 = /^(\d+)\s/.exec(lines[i - 1]);
  const m2 = /^(\d+)\s/.exec(lines[i]);
  if (m1 && m2 && Number(m2[1]) < Number(m1[1])) resets.push(i + 1); // 1-based start line of new session
}
console.log('total lines:', lines.length, '| session boundaries at lines:', resets.join(', ') || '(single session)');
const starts = [1, ...resets];
const sessionOf = i => { let s = 0; for (let k = 0; k < starts.length; k++) if (i >= starts[k]) s = k; return s + 1; };

const errRe = /ERROR|FATAL|Exception|Caused by|^\s*at /;
let printed = 0;
for (let i = 0; i < lines.length; i++) {
  const s = sessionOf(i);
  if (!all && s !== starts.length) continue;            // last session only by default
  if (errRe.test(lines[i])) {
    if (printed < 200) {
      console.log(`session ${s} | line ${i + 1}: ${lines[i].slice(0, 240)}`);
      printed++;
    }
  }
}
if (!printed) console.log('no ERROR/Exception lines found' + (all ? '' : ' in the last session (use --all to scan every session)'));
