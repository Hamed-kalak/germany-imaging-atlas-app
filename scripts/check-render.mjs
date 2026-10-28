/**
 * check-render — render the app's panels for real, at the sizes a reader can
 * actually reach, and fail on a crash, a bad number or a blown time budget.
 *
 * The other two gates prove the NUMBERS are right. Neither one renders
 * anything, so neither would notice a panel that throws, a cell that prints
 * NaN, or a pool so large the tab locks up. "Add everything" puts all 624
 * diagnoses one click away, so the largest case is no longer hypothetical.
 *
 * React's server renderer is used as the harness: it runs the same components,
 * the same memos and the same row loops the browser runs. It does not lay out,
 * so chart internals inside a ResponsiveContainer (which needs a measured
 * width) stay empty here — the lists, the heatmap, the leaderboard, the detail
 * cards and every number formatted into them are all covered.
 *
 *     node scripts/check-render.mjs
 */
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');

const fails = [];
const fail = m => fails.push(m);

// Inside node_modules on purpose: the bundle imports react bare, and node
// resolves that from where the file sits. One React instance, one dispatcher.
const tmp = mkdtempSync(join(APP, 'node_modules', '.p1-render-'));
const esbuild = await import(pathToFileURL(
  join(APP, 'node_modules', 'esbuild', 'lib', 'main.js')).href);

/** Bundle one app module for node: CSS dropped, ?url imports stubbed.
 *  CommonJS out, not ESM: recharts is CJS and calls require('react') at load
 *  time, which an ESM bundle cannot answer for an external package. */
const load = async (rel, name) => {
  const out = join(tmp, `${name}.cjs`);
  await esbuild.build({
    entryPoints: [join(APP, 'src', rel)],
    bundle: true, format: 'cjs', platform: 'node', outfile: out, logLevel: 'error',
    jsx: 'automatic',
    loader: { '.css': 'empty' },
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    plugins: [{
      name: 'stub-url-imports',
      setup(build) {
        build.onResolve({ filter: /\?url$/ }, a => ({ path: a.path, namespace: 'url-stub' }));
        build.onLoad({ filter: /.*/, namespace: 'url-stub' },
          () => ({ contents: 'export default ""', loader: 'js' }));
      },
    }],
  });
  return req(out);
};

// One React instance for the panels and for this harness, or the hooks the
// panels call would look for a dispatcher the renderer never set.
const req = createRequire(join(tmp, 'harness.cjs'));
const { renderToString } = req('react-dom/server');
const { createElement } = req('react');

const { enrich } = await load(join('data', 'dataLoader.ts'), 'dataLoader');
const { computeCodeAggregates, computeChapterAggregates } =
  await load(join('data', 'aggregations.ts'), 'aggregations');
const { ComparisonPanel } = await load(join('components', 'ComparisonPanel.tsx'), 'compare');
const { DetailPanel } = await load(join('components', 'DetailPanel.tsx'), 'detail');
const { DatasetOverview } = await load(join('components', 'DatasetOverview.tsx'), 'overview');

const raw = JSON.parse(readFileSync(join(APP, 'src', 'data', 'realData.json'), 'utf-8'));
const data = enrich(raw).filter(d =>
  d.meta.years_covered >= 15 &&
  (d.meta.n_total / Math.max(1, d.meta.years_covered)) >= 1000);
const codeAggregates = computeCodeAggregates(data);
const chapterAggregates = computeChapterAggregates(data);

/* ── what a rendered panel is never allowed to contain ──────────────────────
 * A rate is a number or it is absent; the one thing it must never be is the
 * string "NaN" on a screen a clinician reads. Same for a stray "undefined" or
 * "Infinity" from a division by a suppressed denominator.
 */
const POISON = [
  ['NaN', /(^|[^a-zA-Z])NaN([^a-zA-Z]|$)/],
  ['undefined', />[^<]*\bundefined\b[^<]*</],
  ['Infinity', /(^|[^a-zA-Z])-?Infinity([^a-zA-Z]|$)/],
];

// Budgets are roughly four times what a development machine measures, which
// leaves room for a slower box without letting a real regression through. The
// numbers they guard, measured 2026-09-18 after the heatmap cap: 26 / 40 / 131
// / 65 / 6 / 118 / 1 / 110 ms.
const timings = [];
const render = (label, el, budgetMs) => {
  let html = '';
  const t0 = process.hrtime.bigint();
  try {
    html = renderToString(el);
  } catch (e) {
    fail(`${label}: threw during render — ${e && e.message ? e.message : e}`);
    return '';
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  timings.push([label, ms, budgetMs]);
  if (ms > budgetMs) {
    fail(`${label}: ${ms.toFixed(0)}ms to render, budget ${budgetMs}ms. ` +
         `A pool this size is one click away ("Add everything"), so this is a ` +
         `reader's tab, not a benchmark.`);
  }
  if (html.length < 500) fail(`${label}: rendered only ${html.length} chars — is it blank?`);
  for (const [name, re] of POISON) {
    if (re.test(html)) fail(`${label}: "${name}" reached the rendered output`);
  }
  return html;
};

/* ── the sizes a reader can reach ───────────────────────────────────────────*/
const ids = [...codeAggregates.keys()];
const oneCode = data.filter(d => d.id === ids[0]);
const chapterIX = data.filter(d => d.chapter === 'IX');
const everything = data;

const compare = (sel, tab, hover = null) => createElement(ComparisonPanel, {
  selectedData: sel,
  codeAggregates,
  label: `${sel.length} diagnoses`,
  sublabel: 'render check',
  pooledCode: 'ALL',
  pooledTitle: 'Every included diagnosis, pooled',
  defaultTab: tab,
  onHighlightChange: () => {},
  hoverCodeId: hover,
  onHoverCode: () => {},
});

render('Compare · 1 diagnosis', compare(oneCode, 'compare'), 300);
render(`Compare · chapter IX (${chapterIX.length})`, compare(chapterIX, 'compare'), 400);
render(`Compare · everything (${everything.length})`, compare(everything, 'compare'), 600);
render(`Pooled · everything (${everything.length})`, compare(everything, 'pooled'), 400);

render('Detail · one diagnosis',
  createElement(DetailPanel, { selectedData: oneCode }), 200);
render(`Detail · everything pooled (${everything.length})`,
  createElement(DetailPanel, { selectedData: everything }), 600);

render('About panel', createElement(DatasetOverview, {
  overallYearly: chapterAggregates.get('IX')?.yearlyRates ?? [],
}), 200);

/* ── a hover must not re-render the world ───────────────────────────────────
 * Hovering a row changes one row's shade. If that costs the same as the first
 * render, every row is being rebuilt, and on a 624-code pool the cursor drags.
 * Rendering twice with a hover set is the closest a server renderer gets to
 * measuring it; what it catches is the quadratic case, where the second pass
 * is no cheaper than the first and both are slow.
 */
render('Compare · everything, one row hovered', compare(everything, 'compare', ids[300]), 600);

rmSync(tmp, { recursive: true, force: true });

console.log(`Render: ${timings.length} panels, largest pool ${everything.length} diagnoses`);
for (const [label, ms, budget] of timings) {
  console.log(`  ${label.padEnd(42)} ${ms.toFixed(0).padStart(5)}ms  (budget ${budget})`);
}
if (fails.length) {
  console.log(`\n  ${fails.length} PROBLEM(S):`);
  for (const f of fails) console.log(`    ${f}`);
  process.exit(1);
}
console.log('  no crash, no NaN, every panel inside its budget: PASSED');
