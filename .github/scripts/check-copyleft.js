// Copyleft license gate — reads one package directory path per stdin line
// (as produced by `npm ls --parseable`) and exits 1 if any package declares
// a GPL/AGPL license.
//
// Matching rules:
// - \b(A?GPL)-\d catches every GPL/AGPL SPDX id (GPL-2.0, GPL-3.0-only,
//   AGPL-3.0-or-later, ...) while the word boundary excludes LGPL, which is
//   deliberately not gated.
// - SPDX `OR` means the licensee chooses, so a dual license fails only when
//   EVERY alternative is copyleft; a permissive alternative is surfaced as a
//   notice instead. `AND`/`WITH` fail on any copyleft part (all terms apply).
//   This catches expressions like "(MIT OR GPL-3.0)" that exact-id matching
//   is blind to (found live: node-forge "(BSD-3-Clause OR GPL-2.0)").
// - Zero readable packages on stdin is a failure (fail closed), so a broken
//   `npm ls` upstream can never read as green.
//
// Self-tested in CI (.github/workflows/ci.yml license-gate job) against
// known-bad and known-good fixtures before every enforcement run.
const fs = require('fs');
const COPYLEFT = /\b(A?GPL)-\d/i;
const isCopyleft = (expr) => {
  const e = expr.replace(/[()]/g, ' ').trim();
  if (/ OR /i.test(e)) return e.split(/ OR /i).every((p) => COPYLEFT.test(p));
  return COPYLEFT.test(e);
};
const lines = fs.readFileSync(0, 'utf8').split('\n').filter(Boolean);
let bad = 0;
let checked = 0;
for (const dir of lines) {
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(dir + '/package.json', 'utf8'));
  } catch {
    continue;
  }
  checked++;
  const lic =
    typeof pkg.license === 'string'
      ? pkg.license
      : pkg.license && pkg.license.type
        ? pkg.license.type
        : Array.isArray(pkg.licenses)
          ? pkg.licenses.map((l) => l.type || l).join(' OR ')
          : '';
  if (isCopyleft(lic)) {
    console.error(`COPYLEFT: ${pkg.name}@${pkg.version} (${lic}) at ${dir}`);
    bad++;
  } else if (COPYLEFT.test(lic)) {
    console.log(`notice: dual-licensed, non-copyleft choice applies: ${pkg.name}@${pkg.version} (${lic})`);
  }
}
if (checked === 0) {
  console.error('license check saw zero packages — failing closed');
  process.exit(1);
}
console.log(`checked ${checked} resolved packages`);
process.exit(bad ? 1 : 0);
