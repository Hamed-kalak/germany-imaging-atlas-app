import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { FilterState } from '../types';

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  stats?: { count: number; obs: number };                                   // whole filtered dataset
  viewStats?: { count: number; obs: number; scope?: 'all' | 'code' | 'codes' | 'chapter' }; // what's shown
  yearBounds?: [number, number] | null;
  embedded?: boolean;
  /** Phones: the three sliders fold away behind a Filters button, so the tiles get the screen. */
  collapsible?: boolean;
}

const fmtObs = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${(n / 1e3).toFixed(0)}k`);

const OBS_MAX = 5000;

export function FilterPanel({ filters, onChange, stats, viewStats, yearBounds, embedded, collapsible = false }: Props) {
  const [open, setOpen] = useState(false);
  const showSliders = !collapsible || open;
  const handleChange = (key: keyof FilterState, val: any) => onChange({ ...filters, [key]: val });

  const isPaperDefault = filters.minObsPerYear === 1000 && filters.minYears === 15 && !filters.yearRange;

  // Year window (falls back to the full dataset range when unset)
  const [yLo, yHi] = filters.yearRange ?? yearBounds ?? [0, 0];
  const yearActive = filters.yearRange != null;
  const yearSpan = yearBounds ? yearBounds[1] - yearBounds[0] : 0;
  const setYears = (lo: number, hi: number) => {
    if (!yearBounds) return;
    let a = Math.round(lo), b = Math.round(hi);
    if (a > b) [a, b] = [b, a];
    a = Math.max(yearBounds[0], Math.min(a, yearBounds[1]));
    b = Math.max(yearBounds[0], Math.min(b, yearBounds[1]));
    const isFull = a <= yearBounds[0] && b >= yearBounds[1];
    onChange({ ...filters, yearRange: isFull ? null : [a, b] });
  };
  const loPct = yearSpan ? ((yLo - yearBounds![0]) / yearSpan) * 100 : 0;
  const hiPct = yearSpan ? ((yHi - yearBounds![0]) / yearSpan) * 100 : 100;

  const minObs = filters.minObsPerYear ?? 0;

  const view = viewStats ?? (stats ? { ...stats, scope: 'all' as const } : null);
  const scoped = !!view && (view.scope ?? 'all') !== 'all';

  return (
    <div className={embedded ? '' : 'card'} style={{ padding: '10px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: embedded ? '1px solid var(--color-border)' : undefined }}>
      <style>{`
        .fp-range { -webkit-appearance:none; appearance:none; width:100%; height:4px; border-radius:3px;
          background:var(--color-border); outline:none; cursor:pointer; }
        .fp-range::-webkit-slider-thumb { -webkit-appearance:none; width:15px; height:15px; border-radius:50%;
          background:var(--color-primary); cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,.25); transition:transform .1s; }
        .fp-range::-webkit-slider-thumb:hover { transform:scale(1.12); }
        .fp-range::-moz-range-thumb { width:15px; height:15px; border:none; border-radius:50%; background:var(--color-primary); cursor:pointer; }
        .fp-dual { position:relative; height:18px; }
        .fp-dual > .track { position:absolute; top:7px; left:0; right:0; height:4px; border-radius:3px; background:var(--color-border); }
        .fp-dual > .fill { position:absolute; top:7px; height:4px; border-radius:3px; background:var(--color-primary); }
        .fp-dual > input { position:absolute; top:0; left:0; width:100%; height:18px; margin:0; background:none;
          pointer-events:none; -webkit-appearance:none; appearance:none; }
        .fp-dual > input::-webkit-slider-thumb { pointer-events:auto; -webkit-appearance:none; width:15px; height:15px;
          border-radius:50%; background:var(--color-surface); border:2px solid var(--color-primary); cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,.2); }
        .fp-dual > input::-moz-range-thumb { pointer-events:auto; width:15px; height:15px; border-radius:50%;
          background:var(--color-surface); border:2px solid var(--color-primary); cursor:pointer; }
      `}</style>

      {/* Band 2 — slim stat row + reset to the published cohort.
          An earlier version had a Paper/All pair here, because its data file carried all 830
          screened codes and "All" dropped the inclusion filter. This build ships
          only the Article's 624, so there is no "All" to switch to; the sliders
          narrow, and this button puts the cohort back. */}
      {view && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
            <span className="num" style={{ fontSize: 19, fontWeight: 800, color: scoped ? 'var(--color-primary)' : 'var(--color-text-main)' }}>{view.count.toLocaleString('en-US')}</span>
            {scoped && <span className="num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>/ {stats!.count.toLocaleString('en-US')}</span>}
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>codes</span>
            <span style={{ color: 'var(--color-border-hover)', margin: '0 1px' }}>·</span>
            <span className="num" style={{ fontSize: 19, fontWeight: 800, color: scoped ? 'var(--color-primary)' : 'var(--color-text-main)' }}>{fmtObs(view.obs)}</span>
            {scoped && <span className="num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>/ {fmtObs(stats!.obs)}</span>}
            <span
              title="Hospital cases with these diagnoses — every admission, imaged or not. CT and MRI are separate tabulations of the same admissions and are never added together: this counts the CT analysis set, or the MRI analysis set for the 17 diagnoses that released no CT cells at all. Over all 624 that comes to 300.4M, against the 297.4M cases of the CT analysis set the Article reports."
              style={{ fontSize: 11, color: 'var(--color-text-muted)', cursor: 'help' }}>hospital cases</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {collapsible && (
            <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8,
                fontSize: 11.5, fontWeight: 600, border: '1px solid var(--color-border)',
                // a cohort other than the published one is flagged even while folded
                background: open ? 'var(--color-secondary)' : 'var(--color-surface)',
                color: isPaperDefault ? 'var(--color-text-main)' : 'var(--color-primary)',
              }}>
              <SlidersHorizontal size={13} />Filters{isPaperDefault ? '' : ' •'}
            </button>
          )}
          <div style={{ display: 'flex', gap: 2, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9, padding: 3, flexShrink: 0 }}>
            <button
              onClick={() => onChange({ minObsPerYear: 1000, minYears: 15, yearRange: null })}
              aria-pressed={isPaperDefault}
              title="At least 1000 case rows a year — summed across the CT and MRI tables, as the Article specifies — and 15 years of coverage"
              style={{
                padding: '5px 14px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, border: 'none',
                cursor: isPaperDefault ? 'default' : 'pointer',
                background: isPaperDefault ? 'var(--color-surface)' : 'transparent',
                color: isPaperDefault ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                boxShadow: isPaperDefault ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s',
              }}>{isPaperDefault ? (collapsible ? 'Published' : 'Published cohort') : (collapsible ? 'Reset' : 'Reset to cohort')}</button>
          </div>
          </div>
        </div>
      )}

      {/* Band 3 — cohort filters, all three on one row. They used to take two
          rows under a "COHORT FILTERS" heading; the labels already say what
          each one is, and the heading and the second row together cost about
          55px of the treemap's height. */}
      {showSliders && (
      <div style={{ display: 'grid', gridTemplateColumns: collapsible ? '1fr 1fr' : '1fr 1fr 1.25fr', gap: 14, alignItems: 'end' }}>
        <>
          {/* Min cases / year */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <label htmlFor="fp-obs" style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--color-text-muted)' }}>Min cases/yr</label>
              <span className="num" style={{ fontSize: 11.5, fontWeight: 700, color: minObs > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                {minObs > 0 ? minObs.toLocaleString('en-US') : 'Off'}
              </span>
            </div>
            <input id="fp-obs" className="fp-range" type="range" min={0} max={OBS_MAX} step={100}
              value={Math.min(minObs, OBS_MAX)}
              onChange={(e) => { const v = Number(e.target.value); handleChange('minObsPerYear', v === 0 ? null : v); }}
            />
          </div>

          {/* Min years */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <label htmlFor="fp-yrs" style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--color-text-muted)' }}>Min years</label>
              <span className="num" style={{ fontSize: 11.5, fontWeight: 700, color: filters.minYears > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                {filters.minYears > 0 ? filters.minYears : 'Off'}
              </span>
            </div>
            <input id="fp-yrs" className="fp-range" type="range" min={0} max={yearSpan || 20} step={1}
              value={Math.min(filters.minYears, yearSpan || 20)}
              onChange={(e) => handleChange('minYears', Number(e.target.value))}
            />
          </div>
        </>

        {/* Year range — dual-thumb slider */}
        {yearBounds && (
          <div style={collapsible ? { gridColumn: '1 / -1' } : undefined}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <label style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--color-text-muted)' }}>Year range</label>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="num" style={{ fontSize: 11.5, fontWeight: 700, color: yearActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>{yLo}–{yHi}</span>
                {yearActive && (
                  <button type="button" onClick={() => onChange({ ...filters, yearRange: null })}
                    style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--color-primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Reset
                  </button>
                )}
              </span>
            </div>
            <div className="fp-dual">
              <div className="track" />
              <div className="fill" style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }} />
              <input type="range" aria-label="From year" min={yearBounds[0]} max={yearBounds[1]} step={1}
                value={yLo} onChange={(e) => setYears(Number(e.target.value), yHi)} />
              <input type="range" aria-label="To year" min={yearBounds[0]} max={yearBounds[1]} step={1}
                value={yHi} onChange={(e) => setYears(yLo, Number(e.target.value))} />
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
