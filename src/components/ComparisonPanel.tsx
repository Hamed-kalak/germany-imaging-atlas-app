/**
 * SetPanel — everything shown for a SET of diagnoses, whether that set is a
 * chapter you navigated into or a selection you assembled by hand.
 *
 * There are exactly two questions to ask of a set, and they are the two modes:
 *
 *   Pooled  — what does this set look like as one thing? Its codes are summed
 *             into a single record and handed to the same DetailPanel a single
 *             diagnosis uses, so a chapter shows what a diagnosis shows.
 *   Compare — how do its members differ? One measure at a time, through a line
 *             per code, a ranking by change per year, and a code × year heatmap.
 *
 * This used to be two components. The chapter panel rendered the pooled view,
 * and this one carried a "Cohort" tab that pooled the selection again — less
 * completely, with no sex-stratified rates and no per-modality split. Two
 * renderings of the same idea, one of them worse. Now there is one panel: the
 * route in (browsing to a chapter, or selecting codes) only decides which mode
 * opens first.
 */
import { useMemo, useState, memo, useCallback, useEffect, useRef } from 'react';
import { IcdData } from '../data/dataLoader';
import { CodeAggregate } from '../types';
import { PAL, CHAPTER_COLORS, SHORT_LABELS, fmtN, chapterOf } from '../data/chapterMeta';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from 'recharts';
import { InfoTip } from './InfoTip';
import { isolatedDot } from '../utils/isolatedDot';
import { DetailPanel } from './DetailPanel';
import { useNarrow } from '../utils/useNarrow';
import { chapterRecord } from '../data/aggregations';

interface Props {
  selectedData: IcdData[];
  codeAggregates: Map<string, CodeAggregate>;
  /** What this set is called in the header — a chapter, a pool, or a diagnosis. */
  label: string;
  /** The grey line under it: the chapter's full name, or the code's chapter. */
  sublabel?: string;
  /** Chip and title for the pooled record (DetailPanel renders them). */
  pooledCode: string;
  pooledTitle: string;
  /** Browsing a chapter opens Pooled; assembling a selection opens Compare. */
  defaultTab?: ViewTab;
  onHighlightChange?: (ids: string[]) => void;
  /** Lifted so the treemap can pick out the same code the cursor is on. */
  hoverCodeId?: string | null;
  onHoverCode?: (id: string | null) => void;
}

type ViewTab = 'pooled' | 'compare';
type Mod = 'ct' | 'mr';
/**
 * 'both' draws CT and MRI together — each solid in its own colour, two heatmap rows.
 *
 * It cannot mean "either modality": CT and MRI are separate tabulations of the
 * same admissions, and an admission with both would be counted twice, so a
 * combined rate is not derivable from what the Research Data Centre returned.
 */
type ModChoice = Mod | 'both';

/* ── helpers ── */
const codeColor = (d: IcdData) =>
  CHAPTER_COLORS[d.chapter] ?? CHAPTER_COLORS[chapterOf(d.code) ?? ''] ?? PAL.ct;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// two-colour interpolation for the heatmap ramp
const HEX = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
function mix(c1: string, c2: string, t: number) {
  const tt = clamp(t, 0, 1);
  const r = Math.round(HEX(c1, 0) + (HEX(c2, 0) - HEX(c1, 0)) * tt);
  const g = Math.round(HEX(c1, 1) + (HEX(c2, 1) - HEX(c1, 1)) * tt);
  const b = Math.round(HEX(c1, 2) + (HEX(c2, 2) - HEX(c1, 2)) * tt);
  return `rgb(${r},${g},${b})`;
}
const RAMP: Record<Mod, [string, string]> = {
  ct: ['#e0efec', '#125f56'],   // light → deep brand teal
  mr: ['#f7ead2', '#8a5414'],   // light → deep brand amber
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--color-surface)', padding: '12px 14px', borderRadius: 12, border: `1px solid ${PAL.border}`, ...style }}>
      {children}
    </div>
  );
}

/* ── Metrics ──
 * Every per-code chart below plots ONE of these, chosen by a single control.
 * They used to be hardwired to the utilisation rate, with age and comorbidity
 * living in a separate tab that had no ranking or heatmap of its own.
 */
export type MetricKey = 'rate' | 'fraction' | 'ratio' | 'age' | 'elix' | 'vws' | 'imaged';

export interface Metric {
  key: MetricKey;
  label: string;
  /** Column header / axis label, kept short. */
  short: string;
  /**
   * The label as it reads mid-sentence. Spelled out rather than lower-cased on
   * the fly, which turned "van Walraven score" into "van walraven score".
   */
  lower: string;
  unit: string;
  /** Percentages start their colour ramp at zero; the others at their minimum. */
  pct: boolean;
  tip: string;
}

export const METRICS: Metric[] = [
  {
    key: 'rate', label: 'Utilisation rate', short: 'Rate', lower: 'utilisation rate', unit: '%', pct: true,
    tip: 'Share of this diagnosis’s admissions with at least one procedure code for the modality: (single + multiple) / all.',
  },
  {
    // The Article's "multiple-code fraction" (Figure 2d). It was labelled
    // "Imaging intensity" until 2026-09-21 -- the Article's name for the
    // RATIO below -- so the two renderings disagreed about what a word meant.
    key: 'fraction', label: 'Multiple-code fraction', short: 'Multi-code %', lower: 'multiple-code fraction', unit: '%', pct: true,
    tip: 'Share of IMAGED admissions carrying more than one procedure code: multiple / (single + multiple). OPS codes are region-specific, so this counts codes per admission — an upper bound on separate examinations, not repeat imaging.',
  },
  {
    key: 'ratio', label: 'Coded imaging intensity', short: 'Multi:single', lower: 'coded imaging intensity', unit: '', pct: false,
    tip: 'Multiple-code admissions divided by single-code ones — the Article’s coded imaging intensity. Above 1, most imaged admissions carry more than one procedure code; CT passed parity (1.02) in 2024; MRI fell from 0.68 in 2005 to 0.49 in 2013 and has stayed at 0.50–0.53 since.',
  },
  {
    key: 'imaged', label: 'Imaged admissions', short: 'Imaged', lower: 'imaged admissions', unit: '', pct: false,
    tip: 'Number of admissions with at least one procedure code for the modality that year. A count, not a rate — useful for seeing which diagnoses carry the volume.',
  },
  {
    key: 'age', label: 'Mean age of the imaged', short: 'Age', lower: 'mean age of the imaged', unit: ' yr', pct: false,
    tip: 'Mean age of the admissions IMAGED with this modality — the single and multiple groups, each weighted by its own count. The not-imaged group is deliberately left out: with it in, CT and MRI describe the same admissions and come out identical.',
  },
  {
    key: 'elix', label: 'Elixhauser count of the imaged', short: 'Elixhauser', lower: 'Elixhauser count of the imaged', unit: '', pct: false,
    tip: 'Mean number of Elixhauser comorbidity groups among the admissions imaged with this modality — the single and multiple groups, weighted by their counts.',
  },
  {
    key: 'vws', label: 'van Walraven score of the imaged', short: 'van Walraven', lower: 'van Walraven score of the imaged', unit: '', pct: false,
    tip: 'Mean van Walraven score — the Elixhauser conditions weighted for in-hospital mortality — among the admissions imaged with this modality, weighted by their counts.',
  },
];

/** One code's value for one year, or null where the cell was not released. */
export function metricValue(t: any, mod: Mod, key: MetricKey): number | null {
  const n = (f: string) => Number(t[`${mod}_${f}`]) || 0;
  const none = n('count_no_male') + n('count_no_female');
  const single = n('count_male') + n('count_female');
  const multi = n('multiple_male') + n('multiple_female');
  const imaged = single + multi;
  const total = imaged + none;

  if (key === 'rate') return total > 0 ? (imaged / total) * 100 : null;
  if (key === 'fraction') return imaged > 0 ? (multi / imaged) * 100 : null;
  if (key === 'ratio') return single > 0 ? multi / single : null;
  if (key === 'imaged') return total > 0 ? imaged : null;

  // Age and comorbidity are stratum means: combine them weighted by the count
  // of the very stratum each belongs to, never by a different one.
  //
  // Only the imaged strata. Including the not-imaged group put the same
  // admissions on both sides — none + single + multiple is one set of people
  // however it is tabulated — so the CT and the MRI curve came out on top of
  // each other and the modality control did nothing.
  const stem = key === 'age' ? 'age' : key === 'elix' ? 'elix' : 'vws';
  const cells: [string, number][] = [
    [`${stem}_male`, n('count_male')], [`${stem}_female`, n('count_female')],
    [`${stem}_mult_male`, n('multiple_male')], [`${stem}_mult_female`, n('multiple_female')],
  ];
  let num = 0, den = 0;
  for (const [field, w] of cells) {
    const v = Number(t[`${mod}_${field}`]);
    if (Number.isFinite(v) && w > 0) { num += v * w; den += w; }
  }
  return den > 0 ? num / den : null;
}

/** Least-squares slope per year over the released points. */
function slopeOf(years: number[], vals: (number | null)[]): number {
  const pts = years.map((y, i) => [y, vals[i]] as const).filter(p => p[1] != null) as [number, number][];
  if (pts.length < 3) return 0;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p[0], 0) / n;
  const my = pts.reduce((a, p) => a + p[1], 0) / n;
  let num = 0, den = 0;
  for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
  return den === 0 ? 0 : num / den;
}

/** Everything the three charts need, computed once per metric/modality change. */
export interface MetricSeries {
  years: number[];
  /** code id -> value per year, aligned with `years`. */
  byCode: Map<string, (number | null)[]>;
  slopes: Map<string, number>;
  min: number;
  max: number;
}

export function buildSeries(data: IcdData[], mod: Mod, key: MetricKey): MetricSeries {
  const years = [...new Set(data.flatMap(d => d.trends.map(t => t.year)))].sort((a, b) => a - b);
  const byCode = new Map<string, (number | null)[]>();
  const slopes = new Map<string, number>();
  let min = Infinity, max = -Infinity;
  for (const d of data) {
    const byYear = new Map(d.trends.map(t => [t.year, t]));
    const vals = years.map(y => {
      const t = byYear.get(y);
      return t ? metricValue(t, mod, key) : null;
    });
    for (const v of vals) if (v != null) { if (v < min) min = v; if (v > max) max = v; }
    byCode.set(d.id, vals);
    slopes.set(d.id, slopeOf(years, vals));
  }
  if (!Number.isFinite(min)) { min = 0; max = 1; }
  return { years, byCode, slopes, min, max };
}

const fmtVal = (v: number, m: Metric) => {
  if (m.key === 'imaged') return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(Math.round(v));
  if (m.key === 'ratio') return v.toFixed(2);
  return `${v.toFixed(1)}${m.unit}`;
};

/* ── Value-by-year heatmap (full width, large cells) ── */
/**
 * How many diagnoses the heatmap draws.
 *
 * Each row is two bands of twenty years, so a row is about forty cells. The
 * whole cohort is 624 rows — 25,000 cells, which React rebuilds on every
 * hover, and a grid that size is not read anyway: it is a texture. The cap
 * bounds the cost of the one click ("Add everything") that can reach it.
 *
 * The rows dropped are the slowest-moving ones, the list says how many were
 * dropped, and the ranking beside it still carries every diagnosis. Nothing is
 * truncated silently.
 */
const MAX_HEATMAP_ROWS = 120;

const MetricHeatmap = memo(function MetricHeatmap({ rows, mod, metric, series, seriesAlt, byId, hoverCodeId, onHover }: {
  rows: CodeAggregate[]; mod: Mod; metric: Metric; series: MetricSeries; seriesAlt?: MetricSeries | null;
  byId: Map<string, IcdData>; hoverCodeId: string | null; onHover: (id: string | null) => void;
}) {
  const [lo, hi] = RAMP[mod];
  const [loAlt, hiAlt] = RAMP.mr;
  // A phone has no room for the rubric beside twenty columns: the row is the
  // code alone, and the ranking above it names each one.
  const narrow = useNarrow();
  const { years, byCode, slopes } = series;

  // Percentages are read against zero; age and comorbidity would be a single
  // flat block on a zero-based ramp, so those start at the observed minimum.
  // With both modalities shown the two bands share one scale, or a cell's
  // shade would mean different things on adjacent rows.
  const [scaleLo, scaleHi] = useMemo(() => {
    const min = Math.min(series.min, seriesAlt ? seriesAlt.min : series.min);
    const max = Math.max(series.max, seriesAlt ? seriesAlt.max : series.max);
    return metric.pct ? [0, Math.max(5, Math.ceil(max / 5) * 5)] : [Math.floor(min), Math.ceil(max)];
  }, [metric, series, seriesAlt]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (slopes.get(b.id) ?? 0) - (slopes.get(a.id) ?? 0)),
    [rows, slopes]
  );
  const shown = sorted.length > MAX_HEATMAP_ROWS ? sorted.slice(0, MAX_HEATMAP_ROWS) : sorted;
  const dropped = sorted.length - shown.length;

  const yr2 = (y: number) => String(y % 100).padStart(2, '0');
  // A wide label column: a bare code is only legible to someone who already
  // knows the classification, and the point of the row is which disease it is.
  // The panel has the width, and at 210px most rubrics were cut to "Malignant
  // neoplasm of small i…", which names the wrong organ.
  const cols = narrow
    ? `46px repeat(${years.length}, minmax(0,1fr)) 40px`
    : `minmax(280px, 460px) repeat(${years.length}, minmax(0,1fr)) 52px`;
  const colGap = narrow ? 1 : 4;
  const labelEvery = years.length > 12 ? 2 : 1;
  // Smaller cells: the grid was sized to fill the card, which made ten rows of
  // 78px squares and pushed everything else off screen.
  const cellH = clamp(Math.floor(300 / Math.max(1, sorted.length * (seriesAlt ? 2 : 1))), seriesAlt ? 12 : 16, 34);
  const span = Math.max(1e-9, scaleHi - scaleLo);

  // The card sizes to its rows rather than stretching: with three diagnoses it
  // used to be mostly empty space below the grid.
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', width: '100%', maxHeight: '100%', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexShrink: 0, flexWrap: 'wrap', rowGap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: PAL.text }}>
            {seriesAlt ? 'CT and MRI' : mod.toUpperCase()} {metric.lower} by year
          </span>
          <span style={{ fontSize: 11, color: PAL.muted }}>
            each cell = one year{seriesAlt ? ' · two rows per diagnosis' : ''}
          </span>
          {dropped > 0 && (
            <span style={{
              fontSize: 10.5, fontWeight: 600, color: 'var(--color-primary)',
              background: 'var(--color-secondary)', padding: '2px 7px', borderRadius: 5,
            }}
              title={`A grid of ${sorted.length} rows is a texture, not a table, and it is rebuilt on every hover. The ${dropped} slowest-moving are left out here; the ranking on the left still lists all ${sorted.length}, and every one of them is counted in Pooled.`}>
              top {shown.length} of {sorted.length}
            </span>
          )}
          <InfoTip text={metric.tip} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span className="num" style={{ fontSize: 10, color: PAL.muted }}>{scaleLo}{metric.unit}</span>
          <div style={{ width: narrow ? 70 : 110, height: 9, borderRadius: 5, background: `linear-gradient(90deg, ${lo}, ${hi})` }} />
          <span className="num" style={{ fontSize: 10, color: PAL.muted }}>{scaleHi}{metric.unit}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: colGap, marginBottom: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: PAL.muted }}>Diagnosis</span>
        {years.map((y, i) => (
          <span key={y} style={{ fontSize: 9, color: PAL.muted, textAlign: 'center' }}>
            {i % (narrow ? labelEvery * 2 : labelEvery) === 0 ? yr2(y) : ''}
          </span>
        ))}
        <span style={{ fontSize: 9, color: PAL.muted, textAlign: 'right' }}>Δ/yr</span>
      </div>

      {/* rows — continuous (gap-free) hit boxes so a vertical sweep jumps
          cleanly between rows; the area scrolls internally when tall. */}
      <div
        onMouseLeave={() => onHover(null)}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>
        {shown.map(r => {
          const icd = byId.get(r.id);
          const chCol = icd ? codeColor(icd) : PAL.muted;
          const isHov = hoverCodeId === r.id;
          const slope = slopes.get(r.id) ?? 0;
          const vals = byCode.get(r.id) ?? [];
          return (
            <div key={r.id}
              onMouseEnter={() => onHover(r.id)} onMouseLeave={() => onHover(null)}
              style={{ display: 'grid', gridTemplateColumns: cols, gap: colGap, alignItems: 'center', padding: '2px 0', borderRadius: 4, background: isHov ? 'var(--color-secondary)' : 'transparent', opacity: hoverCodeId && !isHov ? 0.5 : 1, transition: 'opacity 0.12s, background 0.12s' }}>
              {/* Code and name, both hoverable — hovering the name lights the
                  row, the line in the overlay and the rank, like hovering a cell. */}
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, paddingRight: 4 }}>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                  fontSize: 13, fontWeight: 700, color: isHov ? 'var(--color-primary)' : PAL.text,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: 4, background: chCol, flexShrink: 0 }} />{r.code}
                </span>
                {!narrow && <span title={r.title} style={{
                  fontSize: 12.5, fontWeight: isHov ? 600 : 400,
                  color: isHov ? 'var(--color-text-main)' : PAL.muted,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
                }}>{r.title}</span>}
              </span>
              {years.map((y, i) => {
                const v = vals[i];
                const alt = seriesAlt ? (seriesAlt.byCode.get(r.id) ?? [])[i] : undefined;
                const cell = (val: number | null | undefined, a: string, b: string, tag: string) => (
                  <div title={val != null ? `${r.code} ${tag} · ${y}: ${fmtVal(val, metric)}` : `${r.code} ${tag} · ${y}: not released`}
                    style={{ height: seriesAlt ? cellH : cellH, borderRadius: narrow ? 2 : seriesAlt ? 4 : 6, background: val != null ? mix(a, b, (val - scaleLo) / span) : 'transparent', outline: isHov ? '1.5px solid rgba(0,0,0,0.14)' : 'none', outlineOffset: -1, transition: 'outline-color 0.12s' }} />
                );
                return seriesAlt ? (
                  <div key={y} style={{ display: 'grid', gap: 2 }}>
                    {cell(v, lo, hi, 'CT')}
                    {cell(alt, loAlt, hiAlt, 'MRI')}
                  </div>
                ) : <div key={y}>{cell(v, lo, hi, mod.toUpperCase())}</div>;
              })}
              <span className="num" style={{ fontSize: narrow ? 9.5 : 11, fontWeight: 700, textAlign: 'right', color: slope >= 0 ? PAL.positive : 'var(--color-accent)' }}>
                {slope >= 0 ? '▲' : '▼'}{Math.abs(slope).toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
});

/* ── Fastest-moving Δ/yr leaderboard ── */
const GrowthLeaderboard = memo(function GrowthLeaderboard({ rows, metric, series, byId, hoverCodeId, onHover, named = false }: {
  rows: CodeAggregate[]; metric: Metric; series: MetricSeries;
  byId: Map<string, IcdData>; hoverCodeId: string | null; onHover: (id: string | null) => void;
  /** Name each diagnosis under its code, and light it on a tap: on a phone the
   *  heatmap shows codes only and nothing can be hovered. */
  named?: boolean;
}) {
  const { slopes } = series;
  const sorted = useMemo(() => [...rows].sort((a, b) => (slopes.get(b.id) ?? 0) - (slopes.get(a.id) ?? 0)), [rows, slopes]);
  const maxAbs = useMemo(() => Math.max(1e-6, ...sorted.map(r => Math.abs(slopes.get(r.id) ?? 0))), [sorted, slopes]);

  // A selection of fifty scrolls, so the hovered code is usually off-screen —
  // "where does this one rank?" is unanswerable if you cannot see its row.
  // Bring it into view when the hover comes from somewhere else.
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    if (!hoverCodeId) return;
    const el = rowRefs.current.get(hoverCodeId);
    const list = listRef.current;
    if (!el || !list) return;
    const r = el.getBoundingClientRect(), box = list.getBoundingClientRect();
    if (r.top < box.top || r.bottom > box.bottom) {
      list.scrollTo({ top: el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
    }
  }, [hoverCodeId]);

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: PAL.text }}>Fastest moving</span>
        <span style={{ fontSize: 11, color: PAL.muted, marginLeft: 6 }}>· {metric.short} Δ/yr</span>
        <InfoTip text={`Average year-on-year change in ${metric.lower}, ranked from fastest-rising to falling. Bar length is relative to the largest absolute change in the selection.`} />
      </div>
      {/* Gap-free rows: the 7px between them was dead space that cleared the
          highlight, so sweeping down the list flickered on and off. The breathing
          room is now padding inside each row, and the hit boxes touch. */}
      <div ref={listRef}
        onMouseLeave={named ? undefined : () => onHover(null)}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2, position: 'relative' }}>
        {sorted.map((r, rank) => {
          const icd = byId.get(r.id);
          const chCol = icd ? codeColor(icd) : PAL.muted;
          const slope = slopes.get(r.id) ?? 0;
          const isHov = hoverCodeId === r.id;
          return (
            <div key={r.id}
              ref={(el) => { if (el) rowRefs.current.set(r.id, el); else rowRefs.current.delete(r.id); }}
              title={`#${rank + 1} of ${sorted.length}`}
              onMouseEnter={named ? undefined : () => onHover(r.id)} onMouseLeave={named ? undefined : () => onHover(null)}
              onClick={named ? () => onHover(hoverCodeId === r.id ? null : r.id) : undefined}
              style={{ display: 'grid', gridTemplateColumns: '46px 1fr 52px', gap: 8, alignItems: 'center', padding: named ? '6px 2px' : '3.5px 2px', opacity: hoverCodeId && !isHov ? 0.4 : 1, transition: 'opacity 0.12s', background: isHov ? 'var(--color-secondary)' : 'transparent', borderRadius: 5 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: isHov ? 'var(--color-primary)' : PAL.text }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: chCol, flexShrink: 0 }} />{r.code}
              </span>
              <span style={{ height: 8, borderRadius: 4, background: 'var(--color-bg)', position: 'relative', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', inset: 0, width: `${(Math.abs(slope) / maxAbs) * 100}%`, background: slope >= 0 ? chCol : 'var(--color-accent)', borderRadius: 4 }} />
              </span>
              <span className="num" style={{ fontSize: 11, fontWeight: 700, textAlign: 'right', color: slope >= 0 ? PAL.positive : 'var(--color-accent)' }}>
                {slope >= 0 ? '▲' : '▼'}{Math.abs(slope).toFixed(2)}
              </span>
              {named && (
                <span style={{ gridColumn: '1 / -1', fontSize: 11, color: PAL.muted, marginTop: -3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.title}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
});

/* ── Line overlay, one line per code ── */
const TrendOverlay = memo(function TrendOverlay({ mod, metric, series, seriesAlt, codes, domainIds, byId, hoverCodeId, onHover }: {
  mod: Mod; metric: Metric; series: MetricSeries; seriesAlt?: MetricSeries | null;
  codes: { id: string; code: string }[];
  /** Every code in the set, drawn or not — the axis is scaled to all of them. */
  domainIds: string[];
  byId: Map<string, IcdData>; hoverCodeId: string | null; onHover: (id: string | null) => void;
}) {
  const rows = useMemo(() => series.years.map((year, i) => {
    const row: Record<string, number | null> = { year };
    for (const c of codes) {
      row[c.id] = series.byCode.get(c.id)?.[i] ?? null;
      if (seriesAlt) row[`${c.id}~mr`] = seriesAlt.byCode.get(c.id)?.[i] ?? null;
    }
    return row;
  }), [series, seriesAlt, codes]);

  // Scaled over the whole set rather than the drawn lines: the drawn set now
  // grows by one while a line is hovered, and an axis that rescaled under the
  // cursor made every other line jump as the eye moved down the ranking.
  const yDomain = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const id of domainIds) {
      for (const s of seriesAlt ? [series.byCode.get(id), seriesAlt.byCode.get(id)]
                                : [series.byCode.get(id)]) {
        for (const v of s ?? []) {
          if (v != null && Number.isFinite(v)) { min = Math.min(min, v); max = Math.max(max, v); }
        }
      }
    }
    if (!isFinite(min)) return [0, 30];
    const pad = (max - min) * 0.12 || 2;
    // The headroom was only stopped from crossing zero for percentages, so a
    // count axis could be padded into nonsense: "Imaged admissions" ran from
    // −11,007, and the multiple-to-single ratio from −1. Nothing observed is
    // ever dragged out of frame — the floor only holds where the data itself
    // stays non-negative, which leaves van Walraven (which genuinely can be
    // negative) free to go below it.
    const floor = min >= 0 ? Math.max(0, Math.floor(min - pad)) : Math.floor(min - pad);
    return [floor, Math.ceil(max + pad)];
  }, [series, seriesAlt, domainIds, metric]);

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: PAL.text }}>{metric.label} over time</span>
        <InfoTip text={`${seriesAlt ? 'CT and MRI, each in its own colour' : mod.toUpperCase()} · ${metric.tip} Hover a line — or a row in the ranking or the heatmap — to isolate it.`} />
        {seriesAlt && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 9.5, color: PAL.muted, marginLeft: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12, height: 2.5, borderRadius: 2, background: PAL.ct }} />CT
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12, height: 2.5, borderRadius: 2, background: PAL.mr }} />MRI
            </span>
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={228}>
        <LineChart data={rows} margin={{ top: 4, right: 10, bottom: 4, left: 0 }}
          onMouseLeave={() => onHover(null)}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
          <XAxis dataKey="year" tick={{ fontSize: 10, fill: PAL.muted }} tickLine={false} interval="preserveStartEnd" />
          {/* The raw `toFixed(0)` printed six-figure admission counts into a
              40px gutter, so "106274" came out clipped. fmtVal is what the
              tooltip and the heatmap already use — 106k, and they agree. */}
          <YAxis domain={yDomain} tick={{ fontSize: 10, fill: PAL.muted }} tickLine={false} axisLine={false} width={46} tickFormatter={(v: number) => fmtVal(v, metric)} />
          {/* No tooltip. Reading a line here means "which one is this?", and the
              ranking and the named heatmap rows below answer it without a box
              that covers the very lines being compared. Hovering still lights
              the line, its rank and its heatmap row together. */}
          {codes.map(c => {
            const icd = byId.get(c.id);
            const col = icd ? codeColor(icd) : PAL.muted;
            const isHov = hoverCodeId === c.id;
            // Showing both, the two modalities are told apart by their own
            // colours — the same teal and amber the rest of the page uses, and
            // the same two the heatmap ramps use. A dashed twin in the code's
            // colour read as "the same series, somehow lesser".
            const ctCol = seriesAlt ? PAL.ct : col;
            const op = hoverCodeId && !isHov ? 0.12 : 0.82;
            return [
              <Line key={c.id} type="monotone" dataKey={c.id} stroke={ctCol}
                strokeWidth={isHov ? 3 : 1.5} strokeOpacity={op}
                // Not connectNulls: a suppressed year is a hole in the series,
                // and bridging it would draw a trend across years the Research
                // Data Centre released nothing for. A released year with gaps
                // on both sides gets a dot, or it would vanish entirely.
                dot={isolatedDot(rows.map(r => r[c.id]), ctCol, op)}
                connectNulls={false} isAnimationActive={false}
                onMouseOver={() => onHover(c.id)} />,
              ...(seriesAlt ? [
                <Line key={`${c.id}~mr`} type="monotone" dataKey={`${c.id}~mr`} stroke={PAL.mr}
                  strokeWidth={isHov ? 3 : 1.5}
                  strokeOpacity={op}
                  dot={isolatedDot(rows.map(r => r[`${c.id}~mr`]), PAL.mr, op)}
                  connectNulls={false} isAnimationActive={false}
                  onMouseOver={() => onHover(c.id)} />,
              ] : []),
            ];
          }).flat()}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
});

/* ── Main ── */
export function ComparisonPanel({
  selectedData, codeAggregates, label, sublabel, pooledCode, pooledTitle,
  defaultTab = 'compare', onHighlightChange,
  hoverCodeId: hoverFromParent, onHoverCode,
}: Props) {
  const [tab, setTab] = useState<ViewTab>(defaultTab);
  // On a phone the panel is as tall as its content and the page scrolls it;
  // Compare stacks its three views in one column.
  const narrow = useNarrow();
  // Re-opening on the mode that suits the new route: navigating into a chapter
  // should land on Pooled even if Compare was last used on a selection.
  const routeRef = useRef(defaultTab);
  if (routeRef.current !== defaultTab) { routeRef.current = defaultTab; setTab(defaultTab); }
  const [mod, setMod] = useState<ModChoice>('both');
  // Pooled puts CT and MRI side by side by definition, so it reads as Both and
  // the control is locked — it keeps its place rather than disappearing, and a
  // choice made in Compare is remembered for when Compare comes back.
  const modLocked = tab === 'pooled';
  const shownMod: ModChoice = modLocked ? 'both' : mod;
  const primaryMod: Mod = shownMod === 'mr' ? 'mr' : 'ct';
  const showBoth = shownMod === 'both';
  const [metricKey, setMetricKey] = useState<MetricKey>('rate');
  const [hoverLocal, setHoverLocal] = useState<string | null>(null);
  const hoverCodeId = hoverFromParent !== undefined ? hoverFromParent : hoverLocal;
  const metric = METRICS.find(m => m.key === metricKey)!;
  const series = useMemo(() => buildSeries(selectedData, primaryMod, metricKey), [selectedData, primaryMod, metricKey]);
  // Only built when both are shown; otherwise it is the same work twice.
  const seriesAlt = useMemo(
    () => (showBoth ? buildSeries(selectedData, 'mr', metricKey) : null),
    [showBoth, selectedData, metricKey]);

  const rows = useMemo(
    () => selectedData.map(d => codeAggregates.get(d.id)).filter((a): a is CodeAggregate => a != null),
    [selectedData, codeAggregates]
  );

  // Every row of the heatmap and the ranking needs its code's record, for the
  // chapter colour. `selectedData.find` per row is linear, so the two lists
  // together cost 2n^2 lookups on every hover — 780,000 of them on a
  // whole-cohort pool, 60 times a second while the cursor moves. Once, as a
  // map, instead.
  const byId = useMemo(() => new Map(selectedData.map(d => [d.id, d])), [selectedData]);

  useEffect(() => { onHighlightChange?.(rows.map(r => r.id)); }, [rows, onHighlightChange]);

  // A line per code is unreadable past a couple of dozen; the rest still appear
  // in the ranking and the heatmap below.
  //
  // But the hovered code must always be among them. Hovering a row outside the
  // fastest movers — I47 was 16th of 51 in chapter IX — faded all ten lines to
  // 0.12 and lit none, so the chart read as empty exactly when a reader had
  // asked it a question. Its line is added for as long as it is hovered.
  const overlayCodes = useMemo(() => {
    const top = [...rows]
      .sort((a, b) => Math.abs(series.slopes.get(b.id) ?? 0) - Math.abs(series.slopes.get(a.id) ?? 0))
      .slice(0, showBoth ? 10 : 20).map(r => ({ id: r.id, code: r.code }));
    if (hoverCodeId && !top.some(c => c.id === hoverCodeId)) {
      const r = rows.find(x => x.id === hoverCodeId);
      if (r) top.push({ id: r.id, code: r.code });
    }
    return top;
  }, [rows, series, showBoth, hoverCodeId]);

  // The set summed into one record, so the Pooled tab can hand it to the same
  // DetailPanel a single diagnosis uses. Counts add; stratum means combine
  // weighted by their own counts; rates are recomputed from the pooled counts.
  const pooledRecord = useMemo(() => {
    if (selectedData.length === 1) return selectedData[0];
    // A set spanning several chapters has no chapter of its own. Passing the
    // first member's would label 104 neoplasms + 51 circulatory diagnoses
    // "Neoplasms (C00-D48)", which is simply false; DetailPanel falls back to
    // printing whatever string it is given when it is not a chapter key.
    const chs = new Set(selectedData.map(d => d.chapter));
    const chapter = chs.size === 1 ? [...chs][0] : `${chs.size} chapters`;
    return chapterRecord(selectedData, chapter, pooledCode, pooledTitle);
  }, [selectedData, pooledCode, pooledTitle]);

  const onHover = useCallback((id: string | null) => {
    setHoverLocal(id);
    onHoverCode?.(id);
  }, [onHoverCode]);
  // A tap fires the mouse events too, and on a phone the tapped row then stayed
  // lit with every other one faded. Without a real pointer the line and the
  // heatmap ignore them; the ranking lights a code on an explicit tap instead.
  const canHover = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: hover)').matches;
  const noHover = useCallback((_id: string | null) => {}, []);
  const onPointerHover = canHover ? onHover : noHover;

  const totalCases = useMemo(() => rows.reduce((s, r) => s + (primaryMod === 'ct' ? r.ct_total : r.mr_total), 0), [rows, primaryMod]);
  // Both plots two modalities, so naming only one of their case counts —
  // "13.5M CT cases" over a chart carrying MRI as well — was simply wrong.
  const totalCasesAlt = useMemo(() => rows.reduce((s, r) => s + r.mr_total, 0), [rows]);

  // Which chapters the selection spans — with whole chapters selectable, "104
  // codes" alone no longer says what is being compared.
  const chapterMix = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.chapter, (counts.get(r.chapter) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const TABS: [ViewTab, string, string][] = [
    ['pooled', 'Pooled', 'all of them as one'],
    ['compare', 'Compare', 'one measure, side by side'],
  ];

  return (
    /* Not one white box any more. The mode switch sits on the page background
       above the card, in the same place whatever is being shown, and the card
       below it holds the subject, the controls and the charts. */
    <div style={{ height: narrow ? 'auto' : '100%', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 0 }}>

      {/* ── Row 0 · the mode. On the grey, large, and never moves. ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', rowGap: 6, flexShrink: 0, padding: '0 2px' }}>
        <div style={{
          display: 'flex', gap: 4, background: 'var(--color-surface)',
          border: `1px solid ${PAL.border}`, borderRadius: 13, padding: 4,
          boxShadow: 'var(--shadow-sm)', flexShrink: 0,
        }}>
          {TABS.map(([key, tabLabel, hint]) => (
            <button key={key} onClick={() => setTab(key)} title={hint} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1,
              padding: narrow ? '8px 14px' : '8px 20px', borderRadius: 10, lineHeight: 1.2,
              background: tab === key ? 'var(--color-ink)' : 'transparent',
              color: tab === key ? '#fff' : 'var(--color-text-main)',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              boxShadow: tab === key ? 'var(--shadow-sm)' : 'none',
            }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{tabLabel}</span>
              <span style={{ fontSize: 10, fontWeight: 500, opacity: tab === key ? 0.75 : 0.62 }}>{hint}</span>
            </button>
          ))}
        </div>

        {/* The width to the right of the switch was empty. The case counts read
            better here than crowded against the diagnosis name. */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
          <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: PAL.text }}>
            {selectedData.length === 1 ? '1 diagnosis' : `${selectedData.length} diagnoses`}
          </span>
          <span className="num" style={{ fontSize: 11.5, color: PAL.muted }}>
            {fmtN(totalCases)} CT · {fmtN(totalCasesAlt)} MRI cases
          </span>
          {chapterMix.length > 1 && (
            <span style={{ fontSize: 11, color: PAL.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
              {chapterMix.slice(0, 4).map(([ch, n]) => `${SHORT_LABELS[ch] ?? ch} ${n}`).join(' · ')}
              {chapterMix.length > 4 ? ` · +${chapterMix.length - 4} more` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="card" style={{ flex: narrow ? 'none' : 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: narrow ? 'visible' : 'hidden' }}>

        {/* ── Row 1 · the subject. Identical in both modes, and identical for a
               diagnosis, a pool and a chapter — only the words change. ── */}
        <div style={{ padding: '11px 14px 10px', flexShrink: 0, borderBottom: `1px solid ${PAL.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap', minWidth: 0 }}>
              <span className="num" style={{ background: 'var(--color-ink)', color: '#fff', padding: '4px 11px', borderRadius: 7, fontWeight: 700, fontSize: 14 }}>
                {pooledCode}
              </span>
              <span style={{ fontSize: 17, fontWeight: 700, color: PAL.text, letterSpacing: '-0.01em' }}>{label}</span>
            </div>
            {/* Which modality — pinned to the right edge of the row, not trailing
                the title, so it holds one position whatever the subject is
                called: a chapter's name and a long rubric are very different
                widths and the control was sliding between them. */}
            <div
              title={modLocked ? 'Pooled always shows CT and MRI side by side — choose Compare to plot one of them' : undefined}
              style={{
                display: 'flex', gap: 2, background: 'var(--color-bg)', border: `1px solid ${PAL.border}`,
                borderRadius: 9, padding: 3, flexShrink: 0, marginLeft: 'auto',
                opacity: modLocked ? 0.55 : 1, transition: 'opacity 0.15s',
              }}>
              {(['ct', 'mr', 'both'] as ModChoice[]).map(m => {
                const on = shownMod === m;
                return (
                  <button key={m} onClick={() => setMod(m)} disabled={modLocked}
                    title={m === 'both' ? 'CT and MRI together, each in its own colour — the two are separate tabulations, never added together' : undefined}
                    style={{
                      padding: '5px 13px', borderRadius: 7, fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
                      background: on ? (m === 'ct' ? PAL.ct : m === 'mr' ? PAL.mr : 'var(--color-ink)') : 'transparent',
                      color: on ? '#fff' : PAL.muted,
                      border: 'none', cursor: modLocked ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                    }}>{m === 'both' ? 'Both' : m === 'mr' ? 'MRI' : 'CT'}</button>
                );
              })}
            </div>
          </div>
          {sublabel && (
            <div style={{ fontSize: 11, color: PAL.muted, marginTop: 5 }}>{sublabel}</div>
          )}
          {/* One diagnosis on its own gives no hint that the panel does more.
              It belongs here rather than inside Pooled, so it does not vanish
              the moment Compare is chosen. */}
          {selectedData.length === 1 && (
            <div style={{
              marginTop: 9, padding: '8px 12px', borderRadius: 8,
              background: 'var(--color-accent-tint)',
              border: '1px solid var(--color-accent-line)',
              fontSize: 11.5, lineHeight: 1.5, color: 'var(--color-accent)',
            }}>
              <b style={{ fontWeight: 700 }}>Compare this with others:</b>{' '}
              {narrow ? (
                <>add them by name from the <b style={{ fontWeight: 700 }}>Pool</b> button
                  on the Explore tab — from any chapter.</>
              ) : (
                <>⌘/Ctrl-click more tiles to build a pool — from any chapter — or add
                  them by name from the <b style={{ fontWeight: 700 }}>Pool</b> button.</>
              )}
            </div>
          )}
        </div>

        {/* ── Row 2 · the measure. A fixed-height strip: Pooled used to have no
               controls at all, so choosing Compare grew the header and shoved
               every chart down the panel. ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          minHeight: 46, padding: narrow ? '8px 14px' : '0 14px', flexShrink: 0,
          borderBottom: `1px solid ${PAL.border}`,
        }}>
          {/* One control, one measure, three views of it: picking Mean age
              re-plots the overlay, re-ranks the leaderboard and recolours the
              heatmap. Pooled shows every measure at once, so it says so in the
              same strip rather than leaving a hole. */}
          {tab === 'compare' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: PAL.muted }}>Measure</span>
              <div style={{ display: 'flex', gap: 2, background: 'var(--color-bg)', border: `1px solid ${PAL.border}`, borderRadius: 9, padding: 3, flexWrap: 'wrap' }}>
                {METRICS.map(m => (
                  <button key={m.key} onClick={() => setMetricKey(m.key)} title={m.tip} style={{
                    padding: '5px 11px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                    background: metricKey === m.key ? 'var(--color-primary)' : 'transparent',
                    color: metricKey === m.key ? '#fff' : PAL.muted,
                    border: 'none', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}>{m.short}</button>
                ))}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: PAL.muted }}>
              Every measure at once — utilisation, the multiple-code fraction, the imaging groups,
              age and comorbidity, and each sex on its own.
            </span>
          )}
        </div>

        {/* ── Body — each mode fills what is left and manages its own scroll ── */}
        <div key={tab} style={{ flex: narrow ? 'none' : 1, minHeight: 0, display: 'flex', overflow: narrow ? 'visible' : 'hidden' }}>
          {tab === 'compare' && (
            <div className="reveal-seq" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: narrow ? 10 : 12, width: '100%', height: narrow ? 'auto' : '100%', minHeight: 0 }}>
              {/* fixed-height top row: overlay (left) + leaderboard (scrolls);
                  on a phone the two stack, and tapping a ranked code lights its line */}
              {narrow ? (
                <>
                  <TrendOverlay mod={primaryMod} metric={metric} series={series} seriesAlt={seriesAlt} codes={overlayCodes} domainIds={rows.map(r => r.id)} byId={byId} hoverCodeId={hoverCodeId} onHover={onPointerHover} />
                  <div style={{ height: Math.min(340, 64 + rows.length * 42) }}>
                    <GrowthLeaderboard rows={rows} metric={metric} series={series} byId={byId} hoverCodeId={hoverCodeId} onHover={onHover} named />
                  </div>
                </>
              ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.85fr) minmax(0, 1fr)', gap: 12, flexShrink: 0, height: 268 }}>
                <TrendOverlay mod={primaryMod} metric={metric} series={series} seriesAlt={seriesAlt} codes={overlayCodes} domainIds={rows.map(r => r.id)} byId={byId} hoverCodeId={hoverCodeId} onHover={onHover} />
                <GrowthLeaderboard rows={rows} metric={metric} series={series} byId={byId} hoverCodeId={hoverCodeId} onHover={onHover} />
              </div>
              )}
              {/* heatmap takes the rest, but only as much of it as it needs */}
              <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-start' }}>
                <MetricHeatmap rows={rows} mod={primaryMod} metric={metric} series={series} seriesAlt={seriesAlt} byId={byId} hoverCodeId={hoverCodeId} onHover={onPointerHover} />
              </div>
            </div>
          )}

          {tab === 'pooled' && (
            <div style={{ width: '100%', height: narrow ? 'auto' : '100%', minHeight: 0 }}>
              {/* embedded: the shell above already carries the chip, the name and
                  the counts, so the panel must not print a second header. */}
              <DetailPanel selectedData={[pooledRecord]} modality="all" embedded />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
