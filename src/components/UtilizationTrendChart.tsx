/**
 * UtilizationTrendChart — Reusable Recharts line chart for utilization rate over time.
 * Shows CT (teal) and MR (orange) with hover breakdown of none/single/multi.
 */
import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip, CartesianGrid, Brush } from 'recharts';
import { YearlyRate } from '../types';
import { PAL, fmtN } from '../data/chapterMeta';

interface Props {
  data: YearlyRate[];
  showCt?: boolean;
  showMr?: boolean;
  height?: number;
  compact?: boolean;
  title?: string;
  /** Show a year-range Brush below the chart (keyboard-accessible range slider). */
  showBrush?: boolean;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const d = payload[0]?.payload as YearlyRate | undefined;
  if (!d) return null;

  const hasCt = d.ct_total > 0;
  const hasMr = d.mr_total > 0;

  return (
    <div style={{
      background: 'white', border: '1px solid var(--color-border)',
      borderRadius: 8, padding: '8px 12px', fontSize: 11, lineHeight: 1.6,
      boxShadow: 'var(--shadow-md)', maxWidth: 280,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Year {d.year ?? label}</div>
      {hasCt && (
        <>
          <div style={{ color: PAL.ct, fontWeight: 600 }}>
            CT rate: {d.ct_rate != null ? `${d.ct_rate.toFixed(1)}%` : 'not released'}
          </div>
          <div style={{ color: PAL.muted, paddingLeft: 8, fontSize: 10 }}>
            None {((d.ct_none / d.ct_total) * 100).toFixed(1)}% ({fmtN(d.ct_none)})
            &nbsp;· Single {((d.ct_single / d.ct_total) * 100).toFixed(1)}% ({fmtN(d.ct_single)})
            &nbsp;· Multiple {((d.ct_multi / d.ct_total) * 100).toFixed(1)}% ({fmtN(d.ct_multi)})
          </div>
        </>
      )}
      {hasMr && (
        <>
          <div style={{ color: PAL.mr, fontWeight: 600, marginTop: hasCt ? 4 : 0 }}>
            MRI rate: {d.mr_rate != null ? `${d.mr_rate.toFixed(1)}%` : 'not released'}
          </div>
          <div style={{ color: PAL.muted, paddingLeft: 8, fontSize: 10 }}>
            None {((d.mr_none / d.mr_total) * 100).toFixed(1)}% ({fmtN(d.mr_none)})
            &nbsp;· Single {((d.mr_single / d.mr_total) * 100).toFixed(1)}% ({fmtN(d.mr_single)})
            &nbsp;· Multiple {((d.mr_multi / d.mr_total) * 100).toFixed(1)}% ({fmtN(d.mr_multi)})
          </div>
        </>
      )}
    </div>
  );
}

export function UtilizationTrendChart({
  data, showCt = true, showMr = true,
  height = 200, compact = false, title, showBrush = false,
}: Props) {
  const yDomain = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const d of data) {
      if (showCt && d.ct_rate != null) { min = Math.min(min, d.ct_rate); max = Math.max(max, d.ct_rate); }
      if (showMr && d.mr_rate != null) { min = Math.min(min, d.mr_rate); max = Math.max(max, d.mr_rate); }
    }
    if (!isFinite(min)) return [0, 100];
    const pad = (max - min) * 0.15;
    return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];
  }, [data, showCt, showMr]);

  return (
    <div>
      {title && (
        <div style={{
          fontSize: compact ? 11 : 12, fontWeight: 600,
          color: 'var(--color-text-main)', marginBottom: 4, padding: '0 4px',
        }}>
          {title}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: showBrush ? 2 : 4, left: compact ? 0 : 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: compact ? 9 : 10, fill: PAL.muted }}
            tickLine={false}
            axisLine={{ stroke: PAL.border }}
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: compact ? 9 : 10, fill: PAL.muted }}
            tickLine={false}
            axisLine={{ stroke: PAL.border }}
            tickFormatter={(v: number) => `${v}%`}
            width={compact ? 32 : 42}
          />
          <Tooltip content={<CustomTooltip />} />
          {showCt && (
            <Line
              type="monotone"
              dataKey="ct_rate"
              stroke={PAL.ct}
              strokeWidth={2}
              dot={{ r: compact ? 1.5 : 2.5, fill: PAL.ct }}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'white' }}
              name="CT"
              connectNulls={false}
            />
          )}
          {showMr && (
            <Line
              type="monotone"
              dataKey="mr_rate"
              stroke={PAL.mr}
              strokeWidth={2}
              dot={{ r: compact ? 1.5 : 2.5, fill: PAL.mr }}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'white' }}
              name="MRI"
              connectNulls={false}
            />
          )}
          {showBrush && data.length > 2 && (
            <Brush
              dataKey="year"
              height={20}
              travellerWidth={8}
              stroke={PAL.ink}
              fill="#F1F3F5"
              tickFormatter={(v: any) => `${v}`}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
