/**
 * verify-stamp — the gate that CAN run inside the Docker build.
 *
 * It needs nothing but the app directory: it re-hashes the data file and
 * compares it with the stamp `npm run stamp` wrote after the three real gates
 * passed. So the image cannot be built from a data file that was edited,
 * truncated, swapped, or copied in from somewhere else, and the running
 * container can say at /build.json exactly which data it is serving.
 *
 * It deliberately does NOT check the Article's appendix tables. Those live in
 * research/ and are not in the build context — putting them there to satisfy a
 * check would ship the manuscript inside a public web image.
 *
 *     node scripts/verify-stamp.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');
const DATA = join(APP, 'src', 'data', 'realData.json');
const STAMP = join(APP, 'public', 'build.json');

const die = (msg, how) => {
  console.error(`\n  BUILD REFUSED: ${msg}\n  ${how}\n`);
  process.exit(1);
};

if (!existsSync(STAMP)) {
  die('public/build.json is missing.',
      'Run `npm run stamp` in the repository first — it runs the parity, ' +
      'integrity and render gates and writes the stamp only if all three pass.');
}
if (!existsSync(DATA)) die('src/data/realData.json is missing.', 'The build context is incomplete.');

let stamp;
try {
  stamp = JSON.parse(readFileSync(STAMP, 'utf-8'));
} catch (e) {
  die(`public/build.json is not valid JSON (${e.message}).`, 'Re-run `npm run stamp`.');
}

for (const [name, verdict] of Object.entries(stamp.gates || {})) {
  if (verdict !== 'passed') die(`the stamp records gate "${name}" as ${verdict}.`,
    'Fix the failure and re-run `npm run stamp`.');
}

const bytes = readFileSync(DATA);
const sha = createHash('sha256').update(bytes).digest('hex');

if (bytes.length !== stamp.data.bytes) {
  die(`the data file is ${bytes.length} bytes, the stamp says ${stamp.data.bytes}.`,
      'The data changed after the gates ran. Re-run `npm run stamp`.');
}
if (sha !== stamp.data.sha256) {
  die(`the data file hashes to ${sha.slice(0, 16)}…, the stamp says ${String(stamp.data.sha256).slice(0, 16)}….`,
      'The data changed after the gates ran. Re-run `npm run stamp`.');
}

console.log(`  data verified: ${stamp.data.rows} diagnoses, ${(bytes.length / 1e6).toFixed(1)} MB, ` +
            `sha256 ${sha.slice(0, 16)}…`);
console.log(`  gates on record: ${Object.entries(stamp.gates).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`  built from commit ${stamp.commit} (${stamp.worktree}), stamped ${stamp.built}`);
