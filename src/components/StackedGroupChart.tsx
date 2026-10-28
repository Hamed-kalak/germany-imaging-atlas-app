/**
 * StackedGroupChart — stacked area chart for None/Single/Multiple breakdown.
 * Shows absolute counts or proportional (100% stacked).
 */
import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Line, ComposedChart } from 'recharts';
import { PAL, fmtN, groupRamp, GroupRamp } from '../data/chapterMeta';
import { InfoTip } from './InfoTip';

interface DataPoint {
  year: number;
  /** null where the disclosure filter released no cells for that year. */
  none: number | null;
  single: number | null;
  multi: number | null;
}

interface Props {
  data: DataPoint[];
  title?: string;
  height?: number;
  showRatioLine?: boolean;
  showImagingRatioLine?: boolean;
  compact?: boolean;
  info?: string;
  modality?: 'ct' | 'mr';
}

function CustomTooltip({ active, payload, label, ramp }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const total = (d.none ?? 0) + (d.single ?? 0) + (d.multi ?? 0);
  const released = d.none != null || d.single != null || d.multi != null;
  const pct = (v: number | null) => (v != null && total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '—');
  const c: GroupRamp = ramp ?? PAL.groupCt;

  return (
    <div style={{
      background: 'white', border: `1px solid ${PAL.border}`,
      borderRadius: 8, padding: '8px 12px', fontSize: 11, lineHeight: 1.6,
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>Year {d.year ?? label}</div>
      {!released ? (
        <div style={{ color: PAL.muted }}>No cells released for this year</div>
      ) : (<>
      <div style={{ color: c.none }}>None: {fmtN(d.none ?? 0)} ({pct(d.none)})</div>
      <div style={{ color: c.single }}>Single: {fmtN(d.single ?? 0)} ({pct(d.single)})</div>
      <div style={{ color: c.multi }}>Multiple: {fmtN(d.multi ?? 0)} ({pct(d.multi)})</div>
      <div style={{ color: PAL.muted, marginTop: 2 }}>Total: {fmtN(total)}</div>
      </>)}
      {d.ratio != null && (
        <div style={{ color: PAL.text, marginTop: 2 }}>Multi:Single = {d.ratio.toFixed(2)}</div>
      )}
      {d.imagingRatio != null && (
        <div style={{ color: '#555', marginTop: 1 }}>(Multi+Single):None = {d.imagingRatio.toFixed(2)}</div>
      )}
    </div>
  );
}

export function StackedGroupChart({ data, title, height = 180, showRatioLine = false, showImagingRatioLine = false, compact = false, info, modality = 'ct' }: Props) {
  const COLORS = groupRamp(modality);
  const [mode, setMode] = useState<'absolute' | 'proportional'>('absolute');

  // A year the disclosure filter suppressed carries nulls, which recharts draws
  // as a gap. Reading it as zero would gouge the area down to the axis and put
  // a ratio of 0 on the lines — a value the data do not contain.
  const chartData = data.map(d => {
    const released = d.none != null || d.single != null || d.multi != null;
    const none = d.none ?? 0, single = d.single ?? 0, multi = d.multi ?? 0;
    const total = none + single + multi;
    const ratio = released && single > 0 ? multi / single : null;
    const imagingRatio = released && none > 0 ? (multi + single) / none : null;
    if (!released) {
      return { year: d.year, none: null, single: null, multi: null, ratio: null, imagingRatio: null };
    }
    if (mode === 'proportional' && total > 0) {
      return {
        year: d.year,
        none: (none / total) * 100,
        single: (single / total) * 100,
        multi: (multi / total) * 100,
        ratio,
        imagingRatio,
      };
    }
    return { ...d, ratio, imagingRatio };
  });

  const hasSecondaryAxis = showRatioLine || showImagingRatioLine;
  const ChartComponent = hasSecondaryAxis ? ComposedChart : AreaChart;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        {title && (
          <div style={{ fontSize: 11.5, fontWeight: 700, color: PAL.text, display: 'flex', alignItems: 'center' }}>
            {title}{info && <InfoTip text={info} />}
          </div>
        )}
        <div style={{ display: 'flex', gap: 2, background: PAL.bg, borderRadius: 'var(--radius-pill)', padding: 2 }}>
          {(['absolute', 'proportional'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                fontSize: 9, fontWeight: mode === m ? 600 : 400,
                background: mode === m ? PAL.ct : 'transparent',
                color: mode === m ? 'white' : PAL.muted,
                border: 'none', cursor: 'pointer',
              }}
            >
              {m === 'absolute' ? 'Count' : '%'}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={PAL.border} />
          <XAxis dataKey="year" tick={{ fontSize: 10, fill: PAL.muted }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 10, fill: PAL.muted }}
            tickLine={false}
            axisLine={false}
            tickFormatter={mode === 'proportional' ? (v) => `${v}%` : (v) => fmtN(v)}
          />
          <Tooltip content={<CustomTooltip ramp={COLORS} />} />
          <Area type="monotone" dataKey="none" stackId="1" fill={COLORS.none} fillOpacity={0.85} stroke={COLORS.none} strokeWidth={1} />
          <Area type="monotone" dataKey="single" stackId="1" fill={COLORS.single} fillOpacity={0.85} stroke={COLORS.single} strokeWidth={1} />
          <Area type="monotone" dataKey="multi" stackId="1" fill={COLORS.multi} fillOpacity={0.9} stroke={COLORS.multi} strokeWidth={1} />
          {showRatioLine && (
            <Line type="monotone" dataKey="ratio" stroke={PAL.ink} strokeWidth={2} dot={false} yAxisId="right" name="Multi:Single" />
          )}
          {showImagingRatioLine && (
            <Line type="monotone" dataKey="imagingRatio" stroke={PAL.ink} strokeWidth={2} strokeDasharray="5 3" dot={false} yAxisId="right" name="Imaged:None" />
          )}
          {hasSecondaryAxis && (
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: PAL.muted }} tickLine={false} axisLine={false} />
          )}
        </ChartComponent>
      </ResponsiveContainer>
      {/* Legend — hidden in compact mode */}
      {!compact && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 }}>
          {[
            { label: 'None', color: COLORS.none },
            { label: 'Single', color: COLORS.single },
            { label: 'Multiple', color: COLORS.multi },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: PAL.muted }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color, opacity: 0.7 }} />
              {l.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
