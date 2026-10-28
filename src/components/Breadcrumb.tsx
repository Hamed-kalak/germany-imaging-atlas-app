/**
 * Breadcrumb — shows drill-down navigation path.
 */
import { DrillLevel, CodeAggregate } from '../types';
import { CHAPTER_LABELS, SHORT_LABELS } from '../data/chapterMeta';
import { ChevronRight, Home } from 'lucide-react';

interface Props {
  drillLevel: DrillLevel;
  codeAggregates: Map<string, CodeAggregate>;
  onNavigate: (level: DrillLevel) => void;
  /** The tiles are the pool, not the classification — say so. */
  poolCount?: number;
}

export function Breadcrumb({ drillLevel, codeAggregates, onNavigate, poolCount }: Props) {
  const crumbs: { label: string; title?: string; level: DrillLevel }[] = [
    { label: 'All Chapters', level: { level: 'all' } },
  ];

  // A pool is not a place in the classification. While its tiles are on screen
  // the trail said whichever chapter had last been opened — "Neoplasms (II)"
  // over a pool of two infectious diseases.
  if (poolCount) {
    crumbs.push({
      label: `Your pool (${poolCount})`,
      title: 'Diagnoses you picked by hand, from any chapter',
      level: { level: 'all' },
    });
  } else if (drillLevel.level === 'chapter') {
    crumbs.push({
      label: `${SHORT_LABELS[drillLevel.chapter] ?? drillLevel.chapter} (${drillLevel.chapter})`,
      title: CHAPTER_LABELS[drillLevel.chapter],
      level: drillLevel,
    });
  } else if (drillLevel.level === 'code') {
    const code = codeAggregates.get(drillLevel.codeId);
    if (code) {
      crumbs.push({
        label: `${SHORT_LABELS[code.chapter] ?? code.chapter} (${code.chapter})`,
        title: CHAPTER_LABELS[code.chapter],
        level: { level: 'chapter', chapter: code.chapter },
      });
      crumbs.push({
        label: `${code.code} — ${code.title}`,
        level: drillLevel,
      });
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2,
      padding: '0 4px',
      fontSize: 12,
      color: 'var(--color-text-muted)',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
    }}>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
            {i > 0 && <ChevronRight size={12} style={{ flexShrink: 0, opacity: 0.5 }} />}
            {i === 0 && <Home size={12} style={{ flexShrink: 0, opacity: 0.6 }} />}
            <button
              onClick={() => !isLast && onNavigate(crumb.level)}
              title={crumb.title ?? crumb.label}
              style={{
                background: 'none', border: 'none', padding: '2px 4px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: isLast ? 600 : 400,
                color: isLast ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                cursor: isLast ? 'default' : 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: i === crumbs.length - 1 ? 220 : 160,
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { if (!isLast) e.currentTarget.style.color = 'var(--color-primary)'; }}
              onMouseLeave={(e) => { if (!isLast) e.currentTarget.style.color = 'var(--color-text-muted)'; }}
            >
              {crumb.label}
            </button>
          </span>
        );
      })}
    </div>
  );
}
