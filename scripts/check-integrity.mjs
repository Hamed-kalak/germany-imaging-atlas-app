/**
 * check-integrity — the things check-paper1-parity does not cover.
 *
 * Parity proves every code's rates match appendix table S1. It says nothing
 * about the numbers written into the prose, the diagnosis rubrics, the pooled
 * age and comorbidity figures, or whether a suppressed cell is ever rendered as
 * a value. Those are where a dashboard drifts from its manuscript quietly.
 *
 * Four things, all through the app's OWN entry points:
 *
 *   1. Every hardcoded number in the copy, recomputed from the data AND
 *      checked to be still printed; plus the Article's headline numbers as
 *      data invariants, whether or not a screen shows them.
 *   2. The pooled record — the app's `chapterRecord`, which every chapter and
 *      every hand-built pool goes through — against appendix table S0.
 *   3. All 624 diagnosis rubrics against table S1. (S1 truncates long ones with
 *      an ellipsis for the PDF; the app must extend that prefix, not contradict
 *      it.)
 *   4. A suppression sweep: no unreleased cell may carry a number, no released
 *      cell may be nulled, no rate outside 0-100.
 *
 *     node scripts/check-integrity.mjs      # exits non-zero on any mismatch
 */
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');
const REPO = resolve(APP, '..', '..');
const ANALYSIS = join(REPO, 'research', 'code', 'analysis', 'output');
const S1 = join(REPO, 'research', 'code', 'paper_1_ER', 'supplement', 'tables',
                'tableS1_all_624_codes.json');

const fails = [];
const fail = m => fails.push(m);

const tmp = mkdtempSync(join(tmpdir(), 'p1-integrity-'));
const esbuild = await import(pathToFileURL(
  join(APP, 'node_modules', 'esbuild', 'lib', 'main.js')).href);

const load = async (rel, name) => {
  const out = join(tmp, `${name}.mjs`);
  await esbuild.build({
    entryPoints: [join(APP, 'src', rel)],
    bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'warning',
    plugins: [{
      name: 'stub-url-imports',
      setup(build) {
        build.onResolve({ filter: /\?url$/ }, a => ({ path: a.path, namespace: 'url-stub' }));
        build.onLoad({ filter: /.*/, namespace: 'url-stub' },
          () => ({ contents: 'export default ""', loader: 'js' }));
      },
    }],
  });
  return import(pathToFileURL(out).href);
};

const { enrich } = await load(join('data', 'dataLoader.ts'), 'dataLoader');
const { computeCodeAggregates, chapterRecord } =
  await load(join('data', 'aggregations.ts'), 'aggregations');

const raw = JSON.parse(readFileSync(join(APP, 'src', 'data', 'realData.json'), 'utf-8'));
const data = enrich(raw).filter(d =>
  d.meta.years_covered >= 15 &&
  (d.meta.n_total / Math.max(1, d.meta.years_covered)) >= 1000);

/* ── 1 · the numbers written into the copy ──────────────────────────────────
 * Each entry is a claim that appears verbatim in a component. Changing the
 * copy without changing the data (or the reverse) fails here.
 */
const yr = new Map();
for (const c of data) for (const t of c.trends) {
  const y = Number(t.year);
  const o = yr.get(y) ?? { cs: 0, cm: 0, cn: 0, ms: 0, mm: 0, mn: 0, cMale: 0, cFem: 0, mMale: 0, mFem: 0 };
  for (const sx of ['male', 'female']) {
    o.cs += t[`ct_count_${sx}`] || 0; o.cm += t[`ct_multiple_${sx}`] || 0; o.cn += t[`ct_count_no_${sx}`] || 0;
    o.ms += t[`mr_count_${sx}`] || 0; o.mm += t[`mr_multiple_${sx}`] || 0; o.mn += t[`mr_count_no_${sx}`] || 0;
  }
  o.cMale += (t.ct_count_male || 0) + (t.ct_multiple_male || 0) + (t.ct_count_no_male || 0);
  o.cFem  += (t.ct_count_female || 0) + (t.ct_multiple_female || 0) + (t.ct_count_no_female || 0);
  o.mMale += (t.mr_count_male || 0) + (t.mr_multiple_male || 0) + (t.mr_count_no_male || 0);
  o.mFem  += (t.mr_count_female || 0) + (t.mr_multiple_female || 0) + (t.mr_count_no_female || 0);
  yr.set(y, o);
}
const a = yr.get(2005), b = yr.get(2024);
// CT and MRI are separate tabulations and each has its own denominator: a cell
// suppressed in one is not suppressed in the other.
const ctT = o => o.cs + o.cm + o.cn;
const mrT = o => o.ms + o.mm + o.mn;
let cMale = 0, cFem = 0, mMale = 0, mFem = 0;
for (const o of yr.values()) { cMale += o.cMale; cFem += o.cFem; mMale += o.mMale; mFem += o.mFem; }

// The rise in CT utilisation split between the two imaging groups — the
// "68% / 32%" in DatasetOverview.
const share = (n, o) => n / ctT(o) * 100;
const dTot = share(b.cs + b.cm, b) - share(a.cs + a.cm, a);
const dMulti = share(b.cm, b) - share(a.cm, a);

/* Two kinds of number, and the difference is the point.
 *
 * PRINTED — a number some screen shows. Checked twice: the value must fall out
 * of the data, AND the literal must still be in the component named. A gate
 * that only recomputes goes quietly hollow the day the sentence it guards is
 * deleted; that nearly happened on 2026-09-18, when the four headline cards
 * came out of DatasetOverview and ten of these fourteen claims were left
 * guarding text that no longer existed anywhere.
 *
 * INVARIANT — a headline number of the Article that this shipped data file
 * must still reproduce even though no screen prints it. If one of these moves,
 * the aggregate no longer supports the manuscript it travels with, whatever
 * the interface happens to say.
 */
const ctAll = [...yr.values()].reduce((s, o) => s + ctT(o), 0);
const mrAll = [...yr.values()].reduce((s, o) => s + mrT(o), 0);
const years = [...yr.keys()].sort((x, y2) => x - y2);
const srcCache = new Map();
const srcOf = f => {
  if (!srcCache.has(f)) srcCache.set(f, readFileSync(join(APP, 'src', f), 'utf-8'));
  return srcCache.get(f);
};

const OVERVIEW = 'components/DatasetOverview.tsx';
const COMPARE = 'components/ComparisonPanel.tsx';
const m13 = yr.get(2013);
const mrRatios = years.filter(y => y > 2013).map(y => yr.get(y).mm / yr.get(y).ms);
const mrPlateau = { lo: Math.min(...mrRatios), hi: Math.max(...mrRatios) };
// National DRG case totals (appendix table S6's denominator), one row a year.
const NATIONAL = join(REPO, 'research', 'code', 'analysis', 'assets', 'national_drg_case_totals.csv');
const national = new Map(readFileSync(NATIONAL, 'utf-8').split('\n')
  .filter(l => /^\d{4},/.test(l)).map(l => { const [y, m] = l.split(','); return [Number(y), Number(m) * 1e6]; }));
const covEach = [...national].filter(([y]) => yr.has(y)).map(([y, n]) => ctT(yr.get(y)) / n * 100);
const coverage = { each: covEach, mean: covEach.reduce((x, v) => x + v, 0) / covEach.length };
const printed = [
  ['codes in the file',       data.length,                          624, 0, OVERVIEW, '624'],
  ['CT analysis set, cases (M)',  ctAll / 1e6,                       297, 0, OVERVIEW, '297M / 283M'],
  ['MRI analysis set, cases (M)', mrAll / 1e6,                       283, 0, OVERVIEW, '297M / 283M'],
  ['first year',              years[0],                            2005, 0, OVERVIEW, '2005–2024'],
  ['last year',               years[years.length - 1],             2024, 0, OVERVIEW, '2005–2024'],
  ['CT % male, all years',    cMale / (cMale + cFem) * 100,        49.6, 1, OVERVIEW, '49.6%'],
  ['MRI % male, all years',   mMale / (mMale + mFem) * 100,        49.6, 1, OVERVIEW, '49.6%'],
  ['share of DRG cases covered', coverage.mean,                      85, 0, OVERVIEW, 'about 85% of all German DRG'],
  ['CT multiple:single 2024',  b.cm / b.cs,                         1.02, 2, COMPARE, 'parity (1.02) in 2024'],
  ['MRI multiple:single 2005', a.mm / a.ms,                         0.68, 2, COMPARE, '0.68 in 2005'],
  ['MRI multiple:single 2013', m13.mm / m13.ms,                     0.49, 2, COMPARE, '0.49 in 2013'],
  ['MRI multiple:single after 2013, lowest',  mrPlateau.lo,          0.50, 2, COMPARE, '0.50–0.53 since'],
  ['MRI multiple:single after 2013, highest', mrPlateau.hi,          0.53, 2, COMPARE, '0.50–0.53 since'],
];
// The CT analysis set's share of all DRG cases (appendix table S6, "about 85%"
// in the Article): each year's CT total over the national total.
if (Math.min(...coverage.each) < 84 || Math.max(...coverage.each) > 86.5)
  fail(`coverage: ${Math.min(...coverage.each).toFixed(1)}-${Math.max(...coverage.each).toFixed(1)}% ` +
       'of DRG cases, outside the 84.4-86.0% the Article reports');
const invariant = [
  ['CT utilisation 2005 (%)',             share(a.cs + a.cm, a),                  15.2, 1],
  ['CT utilisation 2024 (%)',             share(b.cs + b.cm, b),                  28.0, 1],
  ['CT fold change',                      share(b.cs + b.cm, b) / share(a.cs + a.cm, a), 1.84, 2],
  ['MRI utilisation 2005 (%)',            (a.ms + a.mm) / mrT(a) * 100,            5.3, 1],
  ['MRI utilisation 2024 (%)',            (b.ms + b.mm) / mrT(b) * 100,            9.4, 1],
  ['CT multiple:single 2005',             a.cm / a.cs,                            0.57, 2],
  ['CT multiple:single 2024',             b.cm / b.cs,                            1.02, 2],
  ['MRI multiple:single 2005',            a.mm / a.ms,                            0.68, 2],
  ['MRI multiple:single 2024',            b.mm / b.ms,                            0.50, 2],
  ['CT multiple share of imaged 2024',    b.cm / (b.cs + b.cm) * 100,             50.6, 1],
  ['CT rise from the multiple group (%)', dMulti / dTot * 100,                      68, 0],
  ['CT rise from the single group (%)',   (dTot - dMulti) / dTot * 100,             32, 0],
];
for (const [label, got, want, nd, file, literal] of printed) {
  if (Number(Number(got).toFixed(nd)) !== want)
    fail(`copy "${label}": ${Number(got).toFixed(nd)} vs the dashboard's ${want}`);
  if (!srcOf(file).includes(literal))
    fail(`copy "${label}": "${literal}" is no longer printed in ${file} — ` +
         `either put it back or move this claim to the invariant list`);
}
for (const [label, got, want, nd] of invariant) {
  if (Number(got.toFixed(nd)) !== want)
    fail(`invariant "${label}": ${got.toFixed(nd)} vs the Article's ${want}`);
}

/* ── 2 · the pooled record against appendix table S0 ────────────────────────
 * chapterRecord is what every chapter and every hand-built pool is rendered
 * from, including the age and comorbidity cards. Pooling all 624 must
 * reproduce the manuscript's baseline table.
 */
const pooled = chapterRecord(data, 'ALL', 'ALL', 'every code pooled');
const s0 = JSON.parse(readFileSync(join(ANALYSIS, 'table1_baseline.json'), 'utf-8'));
const s0rows = label => s0.rows.filter(r => r[0].trim() === label);
const millions = s => Number(String(s).replace('M', ''));
const sumOf = keys => pooled.trends.reduce(
  (s, t) => s + keys.reduce((x, k) => x + (Number(t[k]) || 0), 0), 0);

['ct', 'mr'].forEach((mod, i) => {
  const tag = mod.toUpperCase();
  const single = sumOf([`${mod}_count_male`, `${mod}_count_female`]);
  const multi  = sumOf([`${mod}_multiple_male`, `${mod}_multiple_female`]);
  const none   = sumOf([`${mod}_count_no_male`, `${mod}_count_no_female`]);
  for (const [what, got, label] of [
    [`${tag} single`,   single,               'Single (=1)'],
    [`${tag} multiple`, multi,                'Multiple (2+)'],
    [`${tag} none`,     none,                 'None (0)'],
    [`${tag} total`,    single + multi + none, 'Total'],
  ]) {
    const want = millions(s0rows(label)[i][1]);
    if (Math.abs(got / 1e6 - want) > 0.011) fail(`S0 ${what}: ${(got / 1e6).toFixed(2)}M vs S0 ${want}M`);
  }
});

const stratumMean = (mod, stem, suffix, countKey) => {
  let num = 0, den = 0;
  for (const t of pooled.trends) for (const sx of ['male', 'female']) {
    const v = Number(t[`${mod}_${stem}${suffix}_${sx}`]);
    const w = Number(t[`${mod}_${countKey}_${sx}`]) || 0;
    if (Number.isFinite(v) && w > 0) { num += v * w; den += w; }
  }
  return den > 0 ? num / den : NaN;
};
const GROUPS = [['None', '_no', 'count_no'], ['Single', '', 'count'], ['Multiple', '_mult', 'multiple']];
// Table S0 spells the modality MRI, as the Article does; it said MR until
// 2026-09-21. findIndex returns -1 on a label that has moved, and the reads
// below would then silently compare against row 0 -- which is how a renamed
// row first showed up here as "59.1 vs 624" rather than as a missing label.
// The table writes "vWs", the Article's abbreviation, since 2026-09-28.
for (const [mod, tag] of [['ct', 'CT'], ['mr', 'MRI']]) {
  const ai = s0.rows.findIndex(r => r[0].trim() === `Mean age — ${tag}`);
  const vi = s0.rows.findIndex(r => r[0].trim() === `Mean vWs — ${tag}`);
  if (ai < 0 || vi < 0) {
    fail(`S0 has no "Mean age — ${tag}" / "Mean vWs — ${tag}" row — was it renamed?`);
    continue;
  }
  GROUPS.forEach(([lbl, suf, ck], i) => {
    const age = stratumMean(mod, 'age', suf, ck), wantAge = Number(s0.rows[ai + 1 + i][1]);
    const vws = stratumMean(mod, 'vws', suf, ck), wantVws = Number(s0.rows[vi + 1 + i][1]);
    if (Math.abs(age - wantAge) > 0.05) fail(`S0 ${tag} mean age ${lbl}: ${age.toFixed(1)} vs ${wantAge}`);
    if (Math.abs(vws - wantVws) > 0.005) fail(`S0 ${tag} mean VWS ${lbl}: ${vws.toFixed(2)} vs ${wantVws}`);
  });
}

/* ── 3 · the 624 rubrics ────────────────────────────────────────────────────*/
const s1 = JSON.parse(readFileSync(S1, 'utf-8'));
const s1title = new Map(s1.rows.map(r => [r[0], r[2]]));
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
for (const d of data) {
  const want = s1title.get(d.code);
  if (want == null) { fail(`title: ${d.code} is not in S1`); continue; }
  if (norm(d.title) === norm(want)) continue;
  // S1 truncates long rubrics for the PDF; the app carries the full one.
  const truncated = /…\s*$/.test(want);
  const stem = norm(want.replace(/…\s*$/, ''));
  if (!(truncated && norm(d.title).startsWith(stem)))
    fail(`title ${d.code}: "${d.title}" vs S1 "${want}"`);
}

/* ── 4 · suppression ────────────────────────────────────────────────────────
 * The Article omits cells below the disclosure threshold and never counts them
 * as zero. A chart that plots 0 there asserts "nobody was imaged" where in fact
 * nothing is known.
 */
let gaps = 0;
for (const agg of computeCodeAggregates(data).values()) {
  for (const y of agg.yearlyRates) for (const mod of ['ct', 'mr']) {
    const total = y[`${mod}_total`], imaged = y[`${mod}_imaged`], rate = y[`${mod}_rate`];
    if (total === 0) {
      gaps++;
      if (rate !== null) fail(`${agg.code} ${y.year} ${mod}: nothing released but rate is ${rate}`);
    } else if (rate === null) {
      fail(`${agg.code} ${y.year} ${mod}: ${total} cases released but rate is null`);
    } else if (rate < 0 || rate > 100.0001 || Math.abs(rate - imaged / total * 100) > 1e-9) {
      fail(`${agg.code} ${y.year} ${mod}: rate ${rate} is not ${imaged}/${total}`);
    }
  }
  for (const k of ['ct_slope', 'mr_slope'])
    if (!Number.isFinite(agg[k])) fail(`${agg.code}: ${k} is ${agg[k]}`);
}

// The stored per-sex rates, which the "Utilisation by sex" chart draws as
// they come. Until 2026-09-28 generate_json.py wrote them as single / (single +
// none), leaving the multiple-code admissions out of both terms, and nothing
// here compared them with the counts: I63 CT men 2024 showed 54.9%, not 83.4%.
let sexRates = 0;
for (const c of data) for (const t of c.trends) for (const mod of ['ct', 'mr'])
  for (const sx of ['male', 'female']) {
    const s = t[`${mod}_count_${sx}`] || 0, m = t[`${mod}_multiple_${sx}`] || 0;
    const n = t[`${mod}_count_no_${sx}`] || 0, rate = t[`${mod}_rate_${sx}`];
    if (s + m + n === 0) continue;
    sexRates++;
    if (Math.abs(rate - (s + m) / (s + m + n) * 100) > 1e-9)
      fail(`${c.code} ${t.year} ${mod} ${sx}: stored rate ${rate} is not ` +
           `(single + multiple) / total = ${((s + m) / (s + m + n) * 100).toFixed(4)}`);
  }

rmSync(tmp, { recursive: true, force: true });

console.log(`Paper 1 integrity: ${printed.length} printed claims (value + still on screen), ` +
            `${invariant.length} data invariants, appendix table S0, ` +
            `${data.length} rubrics, ${gaps} suppressed cells, ${sexRates} per-sex rates`);
if (fails.length) {
  console.log(`  ${fails.length} MISMATCH(ES):`);
  for (const f of fails.slice(0, 25)) console.log('   ', f);
  if (fails.length > 25) console.log(`    ... and ${fails.length - 25} more`);
  process.exit(1);
}
console.log('  every printed number, the pooled baseline, every rubric and every gap: PASSED');
