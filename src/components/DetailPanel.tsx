import { useMemo } from 'react';
import { IcdData } from '../data/dataLoader';
import {
  LineChart, Line, ResponsiveContainer, Tooltip as RechartTooltip, YAxis,
} from 'recharts';
import { UtilizationTrendChart } from './UtilizationTrendChart';
import { GenderSplitChart } from './GenderSplitChart';
import { StackedGroupChart } from './StackedGroupChart';
import { computeCodeAggregates } from '../data/aggregations';
import { CHAPTER_LABELS, PAL, fmtN, groupRamp, GroupRamp } from '../data/chapterMeta';
import { InfoTip } from './InfoTip';
import { isolatedDot } from '../utils/isolatedDot';
import { useNarrow } from '../utils/useNarrow';

interface Props {
  selectedData: IcdData[];
  modality?: 'all' | 'ct' | 'mr';
  /**
   * Rendered inside the set panel's shell, which already carries the card, the
   * code chip, the name and the counts. Drops this panel's own header and card
   * chrome so one subject does not get two headers.
   */
  embedded?: boolean;
}

// ── Module-level presentational components ──
// Defined once (not per render) so the recharts instances they contain are not
// torn down and remounted every time DetailPanel re-renders.

function ChartCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: PAL.bg, padding: '6px 8px', borderRadius: 8,
      border: `1px solid ${PAL.border}`, overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

function MetricCard({ label, value, sub, tip }: { label: string; value: string; sub?: string; tip?: string }) {
  return (
    <div style={{ padding: '5px 8px', borderRadius: 6, background: PAL.bg, border: `1px solid ${PAL.border}` }}>
      <div style={{ fontSize: 8, color: PAL.muted, fontWeight: 500, display: 'flex', alignItems: 'center' }}>
        {label}{tip && <InfoTip text={tip} />}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: PAL.text, marginTop: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 8, color: PAL.muted, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function GroupMetricCard({ label, nVal, sVal, mVal, tip, ramp }: {
  label: string; nVal: number | null; sVal: number | null; mVal: number | null; tip?: string; ramp: GroupRamp;
}) {
  // One decimal (JAD, 2026-10-26): whole numbers hid real differences -- an
  // Elixhauser count of 1.4 and 0.6 both read "1" -- and the Compare view
  // already shows these measures to one decimal.
  const fmt = (v: number | null) => v != null ? v.toFixed(1) : '—';
  // Sequential emphasis: None recedes (muted), Single→Multiple deepen in hue.
  const cNone = ramp.none, cSingle = ramp.single, cMulti = ramp.multi;
  return (
    <div style={{ padding: '6px 8px', borderRadius: 6, background: PAL.bg, border: `1px solid ${PAL.border}` }}>
      <div style={{ fontSize: 9, color: PAL.muted, fontWeight: 500, display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        {label}{tip && <InfoTip text={tip} />}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around', gap: 4 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="num" style={{ fontSize: 15, fontWeight: 700, color: cNone, lineHeight: 1.2 }}>{fmt(nVal)}</div>
          <div style={{ fontSize: 8, color: cNone, fontWeight: 500 }}>None</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="num" style={{ fontSize: 15, fontWeight: 700, color: cSingle, lineHeight: 1.2 }}>{fmt(sVal)}</div>
          <div style={{ fontSize: 8, color: cSingle, fontWeight: 500 }}>Single</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="num" style={{ fontSize: 15, fontWeight: 700, color: cMulti, lineHeight: 1.2 }}>{fmt(mVal)}</div>
          <div style={{ fontSize: 8, color: cMulti, fontWeight: 500 }}>Multi</div>
        </div>
      </div>
    </div>
  );
}

// Sparkline tooltip — shows actual year from data
function SparkTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const dataPoint = payload[0]?.payload;
  const year = dataPoint?.year;
  return (
    <div style={{
      background: 'white', border: `1px solid ${PAL.border}`,
      borderRadius: 6, padding: '4px 8px', fontSize: 9, lineHeight: 1.5,
      boxShadow: 'var(--shadow-md)', pointerEvents: 'none' as const, zIndex: 100,
    }}>
      <div style={{ fontWeight: 600 }}>{year != null ? `Year ${year}` : '—'}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.stroke }}>
          {p.name}: {Number.isFinite(p.value) ? Number(p.value).toFixed(1) : '—'}
        </div>
      ))}
    </div>
  );
}

function DemoGroupSparkline({ title, noneKey, singleKey, multiKey, chartData, ramp }: {
  title: string; noneKey: string; singleKey: string; multiKey: string; chartData: any[]; ramp: GroupRamp;
}) {
  const cNone = ramp.none, cSingle = ramp.single, cMulti = ramp.multi;
  const first = chartData[0];
  const fv = (row: any, key: string) => {
    const v = row?.[key];
    return v != null && Number.isFinite(v) ? Number(v).toFixed(1) : '—';
  };
  // Compute tight y domain to highlight differences between N, S, M
  const yDomain = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const row of chartData) {
      for (const key of [noneKey, singleKey, multiKey]) {
        const v = (row as any)[key];
        if (v != null && Number.isFinite(v)) {
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      }
    }
    if (!isFinite(min)) return [0, 100] as [number, number];
    const pad = (max - min) * 0.05 || 1;
    return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10] as [number, number];
  }, [chartData, noneKey, singleKey, multiKey]);

  return (
    <div style={{ padding: '4px 6px', borderRadius: 6, background: PAL.bg, border: `1px solid ${PAL.border}` }}>
      <div style={{ fontSize: 8, fontWeight: 600, color: PAL.muted, marginBottom: 1 }}>{title}</div>
      <div style={{ height: 60 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 0 }}>
            <YAxis
              domain={yDomain}
              width={24}
              tick={{ fontSize: 7, fill: PAL.muted }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v.toFixed(0)}
            />
            <RechartTooltip content={<SparkTooltip />} allowEscapeViewBox={{ x: true, y: true }} />
            {/* Gaps stay gaps, and a released year surrounded by gaps gets a
                dot so it does not disappear along with them. */}
            <Line type="monotone" dataKey={noneKey} stroke={cNone} strokeWidth={1} dot={isolatedDot(chartData.map((d: any) => d[noneKey]), cNone)} connectNulls={false} name="None" />
            <Line type="monotone" dataKey={singleKey} stroke={cSingle} strokeWidth={1} dot={isolatedDot(chartData.map((d: any) => d[singleKey]), cSingle)} connectNulls={false} name="Single" />
            <Line type="monotone" dataKey={multiKey} stroke={cMulti} strokeWidth={1.5} dot={isolatedDot(chartData.map((d: any) => d[multiKey]), cMulti)} connectNulls={false} name="Multiple" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="num" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: PAL.muted }}>
        <span style={{ color: cNone }}>N:{fv(first, noneKey)}</span>
        <span style={{ color: cSingle }}>S:{fv(first, singleKey)}</span>
        <span style={{ color: cMulti }}>M:{fv(first, multiKey)}</span>
      </div>
    </div>
  );
}

// ── Modality column — single column vertical stack ──
function ModalityColumn({ mod, stats, stacked, burden, genderData, chartData }: {
  mod: 'ct' | 'mr';
  stats: GroupSummary;
  /** null where the year was suppressed — StackedGroupChart draws a gap. */
  stacked: { year: number; none: number | null; single: number | null; multi: number | null }[];
  burden: { value: number | null; multi: number | null; imaged: number | null; year: number | null };
  genderData: any[];
  chartData: any[];
}) {
  const color = mod === 'ct' ? PAL.ct : PAL.mr;
  const label = mod === 'ct' ? 'CT' : 'MRI';
  const prefix = mod;
  const ramp = groupRamp(mod);
  // On a phone the header wraps and the three group cards stack: side by side
  // at that width the third one ran off the edge of the screen.
  const narrow = useNarrow();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      {/* Modality header. The counts were 9px and abbreviated to N/S/M, which
          is unreadable and assumes the reader already knows the scheme. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `2px solid ${color}`, paddingBottom: 6, ...(narrow ? { flexWrap: 'wrap' as const, rowGap: 6 } : {}) }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 800, color, letterSpacing: '0.02em' }}>{label}</span>
        <span className="num" style={{ fontSize: 10.5, color: PAL.muted }}>
          {fmtN(stats.total)} cases
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, color: PAL.muted }}>
          {([['none', stats.none], ['single', stats.single], ['multiple', stats.multi]] as const).map(([k, v]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, flexShrink: 0,
                background: k === 'none' ? ramp.none : k === 'single' ? ramp.single : ramp.multi }} />
              <span className="num">{fmtN(v)}</span> {k}
            </span>
          ))}
        </span>
        <div style={{ flex: 1 }} />
        <MetricCard label="Multi-code fraction"
          value={burden.value != null ? `${(burden.value * 100).toFixed(1)}%` : '—'}
          /* the SAME year's numbers as the percentage above. Until
             2026-09-21 this printed stats.multi / stats.single+multi,
             which accumulate over all twenty years, under a percentage
             computed for one: I63 CT showed "75.5%" over "2.1M/3.9M",
             a fraction that works out at 54%. */
          sub={burden.year != null ? `${fmtN(burden.multi ?? 0)}/${fmtN(burden.imaged ?? 0)} · ${burden.year}` : 'not released'}
          tip="The Article’s multiple-code fraction: Multiple / (Single + Multiple) × 100 in the most recent released year — the share of imaged admissions carrying more than one procedure code. OPS codes are region-specific, so a single acquisition covering several regions can contribute more than one; this is not a count of examinations." />
      </div>

      {/* Per-group demographics */}
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : '1fr 1fr 1fr', gap: 7 }}>
        <GroupMetricCard label="Mean age" nVal={stats.ageN} sVal={stats.ageS} mVal={stats.ageM} ramp={ramp}
          tip="Mean age in years, averaged over the released years and weighted by group size. None = no procedure code for this modality, Single = exactly one, Multiple = more than one." />
        <GroupMetricCard label="Elixhauser" nVal={stats.elixN} sVal={stats.elixS} mVal={stats.elixM} ramp={ramp}
          tip="Elixhauser comorbidity count — how many of the 31 Elixhauser condition groups the admission carried, averaged over the released years and weighted by group size. Higher = more comorbidities. N = not imaged, S = one procedure code, M = more than one." />
        <GroupMetricCard label="van Walraven" nVal={stats.vwsN} sVal={stats.vwsS} mVal={stats.vwsM} ramp={ramp}
          tip="van Walraven score — the Elixhauser conditions weighted for in-hospital mortality (van Walraven 2009), averaged over the released years and weighted by group size. N = not imaged, S = one procedure code, M = more than one." />
      </div>

      {/* Utilisation by sex */}
      <ChartCard>
        <GenderSplitChart
          data={genderData}
          showCt={mod === 'ct'} showMr={mod === 'mr'}
          height={160} compact
          info="Solid = Female, Dashed = Male. Shows sex-specific imaging rates over time."
        />
      </ChartCard>

      {/* Imaging groups */}
      <ChartCard>
        <StackedGroupChart
          data={stacked}
          title="Imaging groups"
          height={160}
          modality={mod}
          showRatioLine
          showImagingRatioLine
          compact
          info="Stacked area: None = no procedure code, Single = one code, Multiple = more than one. Imaging rate = (S+M)/Total × 100. Multiple-code fraction = M/(S+M) × 100; coded imaging intensity = M/S. Codes are region-specific, so Multiple does not mean a repeated examination."
        />
      </ChartCard>

      {/* Demographics sparklines */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, fontSize: 8, fontWeight: 600, color: PAL.muted, textTransform: 'uppercase' as const, letterSpacing: 0.3 }}>
          Age and comorbidity by imaging group
          <InfoTip text="Year by year: mean age, Elixhauser comorbidity count and van Walraven score, for each imaging group, weighted by that group\u2019s size in that year. N = not imaged, S = one procedure code, M = more than one." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'repeat(3, minmax(0, 1fr))' : '1fr 1fr 1fr', gap: 6 }}>
          <DemoGroupSparkline title="Age" noneKey={`${prefix}_age_none`} singleKey={`${prefix}_age`} multiKey={`${prefix}_age_multi`} chartData={chartData} ramp={ramp} />
          <DemoGroupSparkline title="Elixhauser" noneKey={`${prefix}_elix_none`} singleKey={`${prefix}_elix`} multiKey={`${prefix}_elix_multi`} chartData={chartData} ramp={ramp} />
          <DemoGroupSparkline title="van Walraven" noneKey={`${prefix}_vws_none`} singleKey={`${prefix}_vws`} multiKey={`${prefix}_vws_multi`} chartData={chartData} ramp={ramp} />
        </div>
      </div>

    </div>
  );
}

interface GroupSummary {
  total: number; single: number; none: number; multi: number;
  ageN: number | null; ageS: number | null; ageM: number | null;
  elixN: number | null; elixS: number | null; elixM: number | null;
  vwsN: number | null; vwsS: number | null; vwsM: number | null;
}

export function DetailPanel({ selectedData, modality = 'all', embedded = false }: Props) {
  // Guard lives in this wrapper (which calls no hooks) so the hook-bearing
  // body below only ever mounts with a non-empty selection — keeping hook
  // order stable across renders (Rules of Hooks).
  if (selectedData.length === 0) {
    return (
      <div className="card" style={{ height: '100%', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: PAL.muted }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 500 }}>No ICD selected</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>Select a code to see details</p>
        </div>
      </div>
    );
  }
  return <DetailPanelInner selectedData={selectedData} modality={modality} embedded={embedded} />;
}

function DetailPanelInner({ selectedData, modality = 'all', embedded = false }: Props) {
  const showCt = modality !== 'mr';
  const showMr = modality !== 'ct';
  // On a phone CT and MRI stack instead of sitting side by side.
  const narrow = useNarrow();
  const twoCols = showCt && showMr && !narrow;

  const d = selectedData[0];
  // Untrimmed twin of `d`, for the model only.

  // ── Compute yearly data ──
  const chartData = useMemo(() => {
    return d.trends.map(t => {
      const numOrNull = (v: any): number | null => {
        if (v == null) return null;          // Number(null) is 0, which is a value, not a gap
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      const weightedAvg = (vM: number | null, cM: number, vF: number | null, cF: number) => {
        const wM = vM == null ? 0 : cM;
        const wF = vF == null ? 0 : cF;
        const total = wM + wF;
        if (total === 0) return null;
        return ((vM as number) * wM + (vF as number) * wF) / total;
      };

      const ct_single = (t.ct_count_male || 0) + (t.ct_count_female || 0);
      const ct_none = (t.ct_count_no_male || 0) + (t.ct_count_no_female || 0);
      const ct_multi = (t.ct_multiple_male || 0) + (t.ct_multiple_female || 0);
      const ct_total = ct_single + ct_none + ct_multi;

      const mr_single = (t.mr_count_male || 0) + (t.mr_count_female || 0);
      const mr_none = (t.mr_count_no_male || 0) + (t.mr_count_no_female || 0);
      const mr_multi = (t.mr_multiple_male || 0) + (t.mr_multiple_female || 0);
      const mr_total = mr_single + mr_none + mr_multi;

      const ct_age = weightedAvg(numOrNull(t.ct_age_male), t.ct_count_male || 0, numOrNull(t.ct_age_female), t.ct_count_female || 0);
      const ct_elix = weightedAvg(numOrNull(t.ct_elix_male), t.ct_count_male || 0, numOrNull(t.ct_elix_female), t.ct_count_female || 0);
      const ct_vws = weightedAvg(numOrNull(t.ct_vws_male), t.ct_count_male || 0, numOrNull(t.ct_vws_female), t.ct_count_female || 0);
      const mr_age = weightedAvg(numOrNull(t.mr_age_male), t.mr_count_male || 0, numOrNull(t.mr_age_female), t.mr_count_female || 0);
      const mr_elix = weightedAvg(numOrNull(t.mr_elix_male), t.mr_count_male || 0, numOrNull(t.mr_elix_female), t.mr_count_female || 0);
      const mr_vws = weightedAvg(numOrNull(t.mr_vws_male), t.mr_count_male || 0, numOrNull(t.mr_vws_female), t.mr_count_female || 0);

      const ct_age_none = weightedAvg(numOrNull(t.ct_age_no_male), t.ct_count_no_male || 0, numOrNull(t.ct_age_no_female), t.ct_count_no_female || 0);
      const ct_elix_none = weightedAvg(numOrNull(t.ct_elix_no_male), t.ct_count_no_male || 0, numOrNull(t.ct_elix_no_female), t.ct_count_no_female || 0);
      const ct_vws_none = weightedAvg(numOrNull(t.ct_vws_no_male), t.ct_count_no_male || 0, numOrNull(t.ct_vws_no_female), t.ct_count_no_female || 0);
      const ct_age_multi = weightedAvg(numOrNull(t.ct_age_mult_male), t.ct_multiple_male || 0, numOrNull(t.ct_age_mult_female), t.ct_multiple_female || 0);
      const ct_elix_multi = weightedAvg(numOrNull(t.ct_elix_mult_male), t.ct_multiple_male || 0, numOrNull(t.ct_elix_mult_female), t.ct_multiple_female || 0);
      const ct_vws_multi = weightedAvg(numOrNull(t.ct_vws_mult_male), t.ct_multiple_male || 0, numOrNull(t.ct_vws_mult_female), t.ct_multiple_female || 0);

      const mr_age_none = weightedAvg(numOrNull(t.mr_age_no_male), t.mr_count_no_male || 0, numOrNull(t.mr_age_no_female), t.mr_count_no_female || 0);
      const mr_elix_none = weightedAvg(numOrNull(t.mr_elix_no_male), t.mr_count_no_male || 0, numOrNull(t.mr_elix_no_female), t.mr_count_no_female || 0);
      const mr_vws_none = weightedAvg(numOrNull(t.mr_vws_no_male), t.mr_count_no_male || 0, numOrNull(t.mr_vws_no_female), t.mr_count_no_female || 0);
      const mr_age_multi = weightedAvg(numOrNull(t.mr_age_mult_male), t.mr_multiple_male || 0, numOrNull(t.mr_age_mult_female), t.mr_multiple_female || 0);
      const mr_elix_multi = weightedAvg(numOrNull(t.mr_elix_mult_male), t.mr_multiple_male || 0, numOrNull(t.mr_elix_mult_female), t.mr_multiple_female || 0);
      const mr_vws_multi = weightedAvg(numOrNull(t.mr_vws_mult_male), t.mr_multiple_male || 0, numOrNull(t.mr_vws_mult_female), t.mr_multiple_female || 0);

      // A year the disclosure filter suppressed arrives with zeros throughout.
      // `|| 0` turned that into a rate of 0%, and the sex-stratified chart drew
      // a plunge to the axis — asserting that nobody was imaged in a year where
      // in fact nothing was released. Null instead, which recharts leaves as a
      // gap, matching the Article: suppressed cells are omitted, never zero.
      const ctReleased = ct_total > 0;
      const mrReleased = mr_total > 0;
      // Release is decided per SEX, not per modality. The disclosure filter
      // works on year x code x sex cells, so one sex can be suppressed while
      // the other is released — routine for a strongly sex-skewed diagnosis.
      // Checking only the modality total left the suppressed sex plotted as a
      // flat 0%, which reads as "never imaged" rather than "not released".
      const released = (mod: 'ct' | 'mr', sx: 'male' | 'female') =>
        ((t as any)[`${mod}_count_no_${sx}`] || 0) + ((t as any)[`${mod}_count_${sx}`] || 0)
        + ((t as any)[`${mod}_multiple_${sx}`] || 0) > 0;
      const ct_rate_male = released('ct', 'male') ? (t.ct_rate_male || 0) : null;
      const ct_rate_female = released('ct', 'female') ? (t.ct_rate_female || 0) : null;
      const mr_rate_male = released('mr', 'male') ? (t.mr_rate_male || 0) : null;
      const mr_rate_female = released('mr', 'female') ? (t.mr_rate_female || 0) : null;

      return {
        year: t.year,
        ct_total,
        ct_single: ctReleased ? ct_single : null,
        ct_none: ctReleased ? ct_none : null,
        ct_multi: ctReleased ? ct_multi : null,
        mr_total,
        mr_single: mrReleased ? mr_single : null,
        mr_none: mrReleased ? mr_none : null,
        mr_multi: mrReleased ? mr_multi : null,
        ct_age, ct_elix, ct_vws,
        mr_age, mr_elix, mr_vws,
        ct_age_none, ct_elix_none, ct_vws_none,
        ct_age_multi, ct_elix_multi, ct_vws_multi,
        mr_age_none, mr_elix_none, mr_vws_none,
        mr_age_multi, mr_elix_multi, mr_vws_multi,
        ct_rate_male, ct_rate_female,
        mr_rate_male, mr_rate_female,
      };
    });
  }, [d]);

  // ── Summary stats ──
  const summary = useMemo(() => {
    const calc = (prefix: 'ct' | 'mr'): GroupSummary => {
      let volSingle = 0, volNone = 0, volMulti = 0;
      let ageSumN = 0, ageWN = 0, ageSumS = 0, ageWS = 0, ageSumM = 0, ageWM = 0;
      let elixSumN = 0, elixWN = 0, elixSumS = 0, elixWS = 0, elixSumM = 0, elixWM = 0;
      let vwsSumN = 0, vwsWN = 0, vwsSumS = 0, vwsWS = 0, vwsSumM = 0, vwsWM = 0;
      for (const t of chartData) {
        const s = (t as any)[`${prefix}_single`] || 0;
        const n = (t as any)[`${prefix}_none`] || 0;
        const m = (t as any)[`${prefix}_multi`] || 0;
        volSingle += s; volNone += n; volMulti += m;
        // None group
        const ageN = (t as any)[`${prefix}_age_none`];
        const elixN = (t as any)[`${prefix}_elix_none`];
        const vwsN = (t as any)[`${prefix}_vws_none`];
        if (ageN != null && Number.isFinite(ageN)) { ageSumN += ageN * n; ageWN += n; }
        if (elixN != null && Number.isFinite(elixN)) { elixSumN += elixN * n; elixWN += n; }
        if (vwsN != null && Number.isFinite(vwsN)) { vwsSumN += vwsN * n; vwsWN += n; }
        // Single group
        const ageS = (t as any)[`${prefix}_age`];
        const elixS = (t as any)[`${prefix}_elix`];
        const vwsS = (t as any)[`${prefix}_vws`];
        if (ageS != null && Number.isFinite(ageS)) { ageSumS += ageS * s; ageWS += s; }
        if (elixS != null && Number.isFinite(elixS)) { elixSumS += elixS * s; elixWS += s; }
        if (vwsS != null && Number.isFinite(vwsS)) { vwsSumS += vwsS * s; vwsWS += s; }
        // Multi group
        const ageM = (t as any)[`${prefix}_age_multi`];
        const elixM = (t as any)[`${prefix}_elix_multi`];
        const vwsM = (t as any)[`${prefix}_vws_multi`];
        if (ageM != null && Number.isFinite(ageM)) { ageSumM += ageM * m; ageWM += m; }
        if (elixM != null && Number.isFinite(elixM)) { elixSumM += elixM * m; elixWM += m; }
        if (vwsM != null && Number.isFinite(vwsM)) { vwsSumM += vwsM * m; vwsWM += m; }
      }
      return {
        total: volSingle + volNone + volMulti,
        single: volSingle, none: volNone, multi: volMulti,
        ageN: ageWN > 0 ? ageSumN / ageWN : null,
        ageS: ageWS > 0 ? ageSumS / ageWS : null,
        ageM: ageWM > 0 ? ageSumM / ageWM : null,
        elixN: elixWN > 0 ? elixSumN / elixWN : null,
        elixS: elixWS > 0 ? elixSumS / elixWS : null,
        elixM: elixWM > 0 ? elixSumM / elixWM : null,
        vwsN: vwsWN > 0 ? vwsSumN / vwsWN : null,
        vwsS: vwsWS > 0 ? vwsSumS / vwsWS : null,
        vwsM: vwsWM > 0 ? vwsSumM / vwsWM : null,
      };
    };
    return { ct: calc('ct'), mr: calc('mr') };
  }, [chartData]);

  const codeAggs = useMemo(() => computeCodeAggregates(selectedData), [selectedData]);
  const codeAgg = codeAggs.get(d.id);

  // ── Stacked group data ──
  const stackedCt = useMemo(() => chartData.map(t => ({
    year: t.year, none: t.ct_none, single: t.ct_single, multi: t.ct_multi,
  })), [chartData]);

  const stackedMr = useMemo(() => chartData.map(t => ({
    year: t.year, none: t.mr_none, single: t.mr_single, multi: t.mr_multi,
  })), [chartData]);

  // ── Gender data ──
  const genderData = useMemo(() => chartData.map(t => ({
    year: t.year,
    ct_rate_male: t.ct_rate_male, ct_rate_female: t.ct_rate_female,
    mr_rate_male: t.mr_rate_male, mr_rate_female: t.mr_rate_female,
  })), [chartData]);

  // ── Multiple-code fraction: share of imaged admissions with >1 procedure code ──
  // (the Article's Figure 2d; its "coded imaging intensity" is the M/S ratio).
  // Quoted for the most recent year the modality was released —
  // not simply the last row, which for a code whose recent years were all
  // suppressed was an empty row and printed "0.0%".
  const repeatBurden = useMemo(() => {
    const lastOf = (mod: 'ct' | 'mr') => {
      for (let i = chartData.length - 1; i >= 0; i--) {
        const r: any = chartData[i];
        const multi = r[`${mod}_multi`] ?? 0;
        const imaged = (r[`${mod}_single`] ?? 0) + multi;
        if (imaged > 0) return { value: multi / imaged, multi, imaged, year: r.year };
      }
      return { value: null as number | null, multi: null as number | null,
               imaged: null as number | null, year: null as number | null };
    };
    return { ct: lastOf('ct'), mr: lastOf('mr') };
  }, [chartData]);

  return (
    // On a phone the page scrolls, not the panel: it grows to its content.
    <div className={embedded ? undefined : 'card'} style={{ height: narrow ? 'auto' : '100%', display: 'flex', flexDirection: 'column', overflow: narrow ? 'visible' : 'hidden' }}>
      {/* Header — what you are looking at, and nothing else.
          A sentence restating the chart underneath it ("CT imaging rose from
          x% to y%") used a third of this panel to say what the axis already
          says, and pushed the one thing a reader needs — which diagnoses these
          are — into 13px. The subject gets the room instead. */}
      {!embedded && (
      <div style={{ padding: '11px 14px 10px', flexShrink: 0, borderBottom: `1px solid ${PAL.border}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
          <span className="num" style={{ background: 'var(--color-ink)', color: '#fff', padding: '4px 11px', borderRadius: 7, fontWeight: 700, fontSize: 14 }}>
            {d.code}
          </span>
          <span style={{ fontSize: 17, fontWeight: 700, color: PAL.text, letterSpacing: '-0.01em' }}>{d.title}</span>
        </div>
        <div style={{ fontSize: 11, color: PAL.muted, marginTop: 5 }}>
          {CHAPTER_LABELS[d.chapter] || d.chapter}
        </div>
      </div>
      )}

      {/* Body — scrollable */}
      {/* The About / Cite pill is fixed bottom-right; the extra bottom padding lets
          the last chart scroll clear of it instead of losing its x-axis under it. */}
      <div className="reveal-seq" style={{ flex: 1, minHeight: 0, overflow: narrow ? 'visible' : 'auto', padding: narrow ? '8px 10px 16px' : '8px 12px 64px' }}>
        {/* Header: overall utilisation trend (CT and MRI side by side) */}
        <div style={{ display: 'grid', gridTemplateColumns: twoCols ? '1fr 1fr' : narrow ? 'minmax(0, 1fr)' : '1fr', gap: 12, marginBottom: 12 }}>
          {showCt && codeAgg && (
            <ChartCard>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: PAL.ct, letterSpacing: '0.02em' }}>CT utilisation</span>
                <InfoTip text="Utilisation rate = (Single + Multiple) / Total × 100: the share of admissions with this diagnosis that carried at least one CT procedure code in each year. Slope = linear trend in percentage points per year." />
              </div>
              <UtilizationTrendChart data={codeAgg.yearlyRates} showCt showMr={false} height={200} />
              <div style={{ fontSize: 9, color: PAL.muted, marginTop: 2 }}>
                <span style={{ color: PAL.ct, fontWeight: 700 }}>CT</span>
                {' '}{codeAgg.ct_rate_early != null ? `${codeAgg.ct_rate_early.toFixed(1)}%` : '—'} → {codeAgg.ct_rate_late != null ? `${codeAgg.ct_rate_late.toFixed(1)}%` : '—'}
                {' '}({codeAgg.ct_slope >= 0 ? '+' : '−'}{Math.abs(codeAgg.ct_slope).toFixed(2)} pp/yr)
              </div>
            </ChartCard>
          )}
          {showMr && codeAgg && (
            <ChartCard>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: PAL.mr, letterSpacing: '0.02em' }}>MRI utilisation</span>
                <InfoTip text="Utilisation rate = (Single + Multiple) / Total × 100: the share of admissions with this diagnosis that carried at least one MRI procedure code in each year. Slope = linear trend in percentage points per year." />
              </div>
              <UtilizationTrendChart data={codeAgg.yearlyRates} showCt={false} showMr height={200} />
              <div style={{ fontSize: 9, color: PAL.muted, marginTop: 2 }}>
                <span style={{ color: PAL.mr, fontWeight: 700 }}>MRI</span>
                {' '}{codeAgg.mr_rate_early != null ? `${codeAgg.mr_rate_early.toFixed(1)}%` : '—'} → {codeAgg.mr_rate_late != null ? `${codeAgg.mr_rate_late.toFixed(1)}%` : '—'}
                {' '}({codeAgg.mr_slope >= 0 ? '+' : '−'}{Math.abs(codeAgg.mr_slope).toFixed(2)} pp/yr)
              </div>
            </ChartCard>
          )}
        </div>

        {/* Modality sections: CT and MR side by side, each as a single column */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: twoCols ? '1fr 1fr' : narrow ? 'minmax(0, 1fr)' : '1fr',
          gap: 14,
        }}>
          {showCt && (
            <ModalityColumn mod="ct" stats={summary.ct} stacked={stackedCt}
              burden={repeatBurden.ct}
              genderData={genderData} chartData={chartData} />
          )}
          {showMr && (
            <ModalityColumn mod="mr" stats={summary.mr} stacked={stackedMr}
              burden={repeatBurden.mr}
              genderData={genderData} chartData={chartData} />
          )}
        </div>
      </div>
    </div>
  );
}
