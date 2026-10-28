/**
 * stamp-build — run every gate, then record what passed and on which data.
 *
 * The three gates can only run in the repository: two of them read the
 * Article's appendix tables from research/, which is not in the Docker build
 * context and should not be. So the image cannot check itself against the
 * manuscript. What it CAN do is refuse to be built from data that never
 * passed — and that is what this stamp is for.
 *
 *   here (in the repo):   npm run stamp   → gates run, public/build.json written
 *   in the image build:   verify-stamp    → re-hashes the data, compares
 *
 * If the two disagree, the image build fails. The only way to ship a changed
 * realData.json is to re-run the gates on it. The stamp is also served at
 * /build.json, so a running container can be asked what it is.
 *
 *     node scripts/stamp-build.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');
const DATA = join(APP, 'src', 'data', 'realData.json');
const OUT_DIR = join(APP, 'public');
const OUT = join(OUT_DIR, 'build.json');

const GATES = [
  ['parity', 'check-paper1-parity.mjs'],
  ['integrity', 'check-integrity.mjs'],
  ['render', 'check-render.mjs'],
];

const results = {};
let bad = 0;
for (const [name, script] of GATES) {
  process.stdout.write(`  ${name.padEnd(10)}`);
  const r = spawnSync(process.execPath, [join(HERE, script)], { encoding: 'utf-8' });
  const ok = r.status === 0;
  results[name] = ok ? 'passed' : 'FAILED';
  if (!ok) {
    bad++;
    console.log('FAILED');
    console.log((r.stdout || '').split('\n').filter(Boolean).slice(-8).map(l => `      ${l}`).join('\n'));
    if (r.stderr) console.log(`      ${r.stderr.split('\n')[0]}`);
  } else {
    console.log('passed');
  }
}
if (bad) {
  console.log(`\n${bad} gate(s) failed — no stamp written, so no image can be built ` +
              `from this working tree.`);
  process.exit(1);
}

const bytes = readFileSync(DATA);
const rows = JSON.parse(bytes.toString('utf-8')).length;
const git = (...a) => {
  const r = spawnSync('git', a, { cwd: APP, encoding: 'utf-8' });
  return r.status === 0 ? r.stdout.trim() : null;
};
const dirty = git('status', '--porcelain', '--', '.');

const stamp = {
  app: 'imaging-atlas-germany',
  built: new Date().toISOString(),
  commit: git('rev-parse', '--short', 'HEAD'),
  worktree: dirty ? 'modified since that commit' : 'clean',
  data: {
    file: 'src/data/realData.json',
    rows,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  },
  gates: results,
};

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(stamp, null, 2) + '\n', 'utf-8');

console.log(`\nStamped ${stamp.data.rows} diagnoses, ${(stamp.data.bytes / 1e6).toFixed(1)} MB, ` +
            `sha256 ${stamp.data.sha256.slice(0, 16)}…`);
console.log(`  commit ${stamp.commit} (${stamp.worktree})`);
console.log(`  wrote public/build.json — the image build will refuse any other data.`);
