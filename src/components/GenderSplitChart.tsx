/**
 * GenderSplitChart — Male vs Female utilization rate trends.
 * Shows CT and/or MR with solid (Female) and dashed (Male) lines.
 */
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { PAL } from '../data/chapterMeta';
import { InfoTip } from './InfoTip';

interface DataPoint {
  year: number;
  /** null = that sex's cell was not released that year (a gap, never a zero) */
  ct_rate_male: number | null;
  ct_rate_female: number | null;
  mr_rate_male: number | null;
  mr_rate_female: number | null;
}

interface Props {
  data: DataPoint[];
  showCt?: boolean;
  showMr?: boolean;
  height?: number;
  /** Accepted for call-site symmetry with the other charts; unused. */
  compact?: boolean;
  info?: string;
}

// A suppressed sex arrives as null (DetailPanel nulls the rate of a sex whose
// cell the disclosure filter withheld). The tooltip must say so, not crash:
// until 2026-09-22 it gated on "either rate > 0" and then called toFixed on
// the null one, which took the whole page down on hover for 275 of the 624
// diagnoses. It also printed a female-minus-male difference, which nothing in
// this build may derive -- removed.
const fmt = (v: number | null | undefined) => (v == null ? 'not released' : `${v.toFixed(1)}%`);

function CustomTooltip({ active, payload, label, showCt, showMr }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div style={{
      background: 'white', border: `1px solid ${PAL.border}`,
      borderRadius: 8, padding: '8px 12px', fontSize: 11, lineHeight: 1.6,
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>Year {d.year ?? label}</div>
      {/* Gate on whether the modality has any data this year, not on the male
          rate alone — otherwise a legitimate 0% male / non-zero female year is dropped. */}
      {showCt && (d.ct_rate_male != null || d.ct_rate_female != null) && (
        <div>
          <span style={{ color: PAL.ct, fontWeight: 600 }}>CT</span>
          {' '}♂ {fmt(d.ct_rate_male)} · ♀ {fmt(d.ct_rate_female)}
        </div>
      )}
      {showMr && (d.mr_rate_male != null || d.mr_rate_female != null) && (
        <div>
          <span style={{ color: PAL.mr, fontWeight: 600 }}>MRI</span>
          {' '}♂ {fmt(d.mr_rate_male)} · ♀ {fmt(d.mr_rate_female)}
        </div>
      )}
    </div>
  );
}

export function GenderSplitChart({ data, showCt = true, showMr = true, height = 140, info }: Props) {
  // Rates are shown for each sex separately, as the SAGER guidelines require.
  // An earlier version also printed an early-vs-late "gap" here — male rate
  // minus female rate in percentage points. Nothing in this build is derived
  // from the difference between the sexes: the data (one mean per
  // year x code x sex cell) cannot support it.
  // A sex with no released year draws nothing at all, and an empty line beside
  // a full one reads as "never imaged" rather than "not released". Say which.
  const mod = showCt ? 'ct' : 'mr';
  const missing = (['male', 'female'] as const).filter(
    sx => !data.some(d => (d as any)[`${mod}_rate_${sx}`] != null));

  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: PAL.text, marginBottom: 6, display: 'flex', alignItems: 'center' }}>
        Utilisation by sex
        {info && <InfoTip text={info} />}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={PAL.border} />
          <XAxis dataKey="year" tick={{ fontSize: 10, fill: PAL.muted }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: PAL.muted }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
          <Tooltip content={<CustomTooltip showCt={showCt} showMr={showMr} />} />
          {showCt && <Line type="monotone" dataKey="ct_rate_female" stroke={PAL.ct} strokeWidth={2} dot={false} connectNulls={false} name="CT ♀" />}
          {showCt && <Line type="monotone" dataKey="ct_rate_male" stroke={PAL.ct} strokeWidth={1.5} strokeDasharray="4 2" dot={false} connectNulls={false} name="CT ♂" />}
          {showMr && <Line type="monotone" dataKey="mr_rate_female" stroke={PAL.mr} strokeWidth={2} dot={false} connectNulls={false} name="MRI ♀" />}
          {showMr && <Line type="monotone" dataKey="mr_rate_male" stroke={PAL.mr} strokeWidth={1.5} strokeDasharray="4 2" dot={false} connectNulls={false} name="MRI ♂" />}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend — always shown: solid vs dashed is the only way to tell
          the two series apart, and compact mode had no key at all. */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: PAL.muted }}>
          <svg width={16} height={8}><line x1={0} y1={4} x2={16} y2={4} stroke={PAL.text} strokeWidth={2} /></svg>
          Female (solid)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: PAL.muted }}>
          <svg width={16} height={8}><line x1={0} y1={4} x2={16} y2={4} stroke={PAL.text} strokeWidth={1.5} strokeDasharray="4 2" /></svg>
          Male (dashed)
        </div>
      </div>
      {missing.length > 0 && missing.length < 2 && (
        <div style={{ fontSize: 9, color: PAL.muted, textAlign: 'center', marginTop: 2 }}>
          {missing[0] === 'male' ? 'Men' : 'Women'}: no year cleared the disclosure threshold
        </div>
      )}
    </div>
  );
}
