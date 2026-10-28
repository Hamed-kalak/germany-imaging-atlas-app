/**
 * NavigationPanel — the chapter/code treemap with its CT/MR and rate/volume
 * toggles.
 */
import { useState, useRef, useEffect } from 'react';
import { ChapterAggregate, CodeAggregate, DrillLevel, CodeGroup } from '../types';
import { TileNav, TILE_METRICS, type Metric } from './TileNav';
import { IcdData } from '../data/dataLoader';
import { SelectionTray } from './SelectionTray';
import { ChevronLeft, ChevronDown, Layers, X, LayoutGrid, List } from 'lucide-react';
import { useNarrow } from '../utils/useNarrow';
import { PAL, SHORT_LABELS } from '../data/chapterMeta';

interface Props {
  chapterAggregates: Map<string, ChapterAggregate>;
  codeAggregates: Map<string, CodeAggregate>;
  modality: 'ct' | 'mr';
  drillLevel: DrillLevel;
  onChapterClick: (chapter: string) => void;
  onCodeClick: (codeId: string) => void;
  filteredData: IcdData[];
  selectedIds: string[];
  onSelect: (id: string, additive?: boolean) => void;
  /** Replace or extend the selection with a whole set of codes. */
  onSelectMany: (ids: string[], additive: boolean) => void;
  onClearSelection: () => void;
  onShowPool: () => void;
  /** Adding from the pool popover — distinct from a tile click, because it
   *  hands the treemap to the pool there and then. */
  onPoolToggle: (id: string) => void;
  onPoolAddMany: (ids: string[]) => void;
  poolShowing: boolean;
  /** Pool is the subject — the tiles become the pool. */
  poolMode: boolean;
  onGroupSelect?: (ids: string[]) => void;
  savedGroups?: CodeGroup[];
  onSaveGroup?: (name: string, codeIds: string[]) => void;
  onDeleteGroup?: (groupId: string) => void;
}

export function NavigationPanel({
  chapterAggregates, codeAggregates, modality, drillLevel,
  onChapterClick, selectedIds, onSelect, onSelectMany, onClearSelection,
  onShowPool, onPoolToggle, onPoolAddMany, poolShowing, poolMode,
}: Props) {
  const activeChapter = drillLevel.level === 'chapter' ? drillLevel.chapter : null;
  const activeCode = drillLevel.level === 'code' ? drillLevel.codeId : null;
  // The chapter whose codes are on screen — an explicit drill, or the parent of
  // the selected code.
  const chapterCtx = activeChapter ?? (activeCode ? codeAggregates.get(activeCode)?.chapter ?? null : null);
  const chapterCodes = chapterCtx ? chapterAggregates.get(chapterCtx)?.codes ?? [] : [];
  const [localModality, setLocalModality] = useState<'ct' | 'mr'>(modality);
  const [metric, setMetric] = useState<Metric>('rate');
  const [moreOpen, setMoreOpen] = useState(false);
  const [poolOpen, setPoolOpen] = useState(false);
  // Phones only: the tiles, or the same tiles as a list when they are too small to tap.
  const narrow = useNarrow();
  const [asList, setAsList] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const poolRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!poolOpen) return;
    const away = (e: MouseEvent) => {
      if (poolRef.current && !poolRef.current.contains(e.target as Node)) setPoolOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPoolOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [poolOpen]);
  useEffect(() => {
    if (!moreOpen) return;
    const away = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [moreOpen]);
  const primary = TILE_METRICS.filter(m => m.primary);
  const extra = TILE_METRICS.filter(m => !m.primary);
  const activeExtra = extra.find(m => m.key === metric);

  // How much of the pool the current cohort actually holds. The filters can
  // exclude a picked code, and counting the picks rather than the drawable ones
  // was what made the button, the tiles and the panel disagree.
  const inCohort = selectedIds.filter(id => codeAggregates.has(id));
  const hiddenCount = selectedIds.length - inCohort.length;

  /** Back = out of here and start clean: the pool goes with it. */
  const goBack = () => { onClearSelection(); onChapterClick(''); };

  const track: React.CSSProperties = {
    display: 'flex', gap: 2, background: 'var(--color-bg)', borderRadius: 9, padding: 3,
    border: '1px solid var(--color-border)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Toolbar — Back · Modality (left) · metric (right), one row above the nav */}
      {/* Wraps when it does not fit -- on a phone; on a desktop it never does. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        flexWrap: 'wrap', rowGap: 8,
        padding: '9px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Back to general tiles — clear, separate from the tile grid */}
          {(activeChapter || activeCode || poolMode) && (
            <button
              onClick={goBack}
              title={selectedIds.length
                ? 'Back to all chapters, and empty the pool'
                : 'Back to all chapters'}
              style={{
                display: 'flex', alignItems: 'center', gap: 3, padding: '6px 11px 6px 8px', borderRadius: 8,
                border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                color: 'var(--color-text-main)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <ChevronLeft size={15} /> Back
            </button>
          )}

          {/* The pool, behind a button. */}
          <div style={{ position: 'relative' }} ref={poolRef}>
            <button
              onClick={() => setPoolOpen(o => !o)}
              aria-haspopup="dialog" aria-expanded={poolOpen}
              title="What you have picked"
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: selectedIds.length ? 'var(--color-primary)' : 'var(--color-surface)',
                color: selectedIds.length ? '#fff' : 'var(--color-text-muted)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* The count is what the cohort holds, not what was picked — with
                  a tight filter the two differ, and "N of M" says so rather
                  than promising tiles that are not there. */}
              <Layers size={14} />Pool{selectedIds.length
                ? ` · ${inCohort.length}${hiddenCount ? ` of ${selectedIds.length}` : ''}`
                : ''}
            </button>
            {poolOpen && (
              <SelectionTray
                selectedIds={selectedIds}
                codeAggregates={codeAggregates}
                chapterCodes={chapterCodes}
                chapterName={chapterCtx ? (SHORT_LABELS[chapterCtx] ?? chapterCtx).replace(/\u00AD/g, '') : ''}
                hiddenCount={hiddenCount}
                onToggle={onPoolToggle}
                onAddMany={onPoolAddMany}
                onShow={onShowPool}
                showing={poolShowing}
                onClose={() => setPoolOpen(false)}
              />
            )}
          </div>

          {/* Clear sits beside the pool rather than inside it: emptying what you
              picked should not need the popover opened first. */}
          {selectedIds.length > 0 && (
            <button
              onClick={() => { onClearSelection(); setPoolOpen(false); }}
              title="Empty the pool, and stay where you are"
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8,
                border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                color: 'var(--color-accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <X size={13} /> Clear
            </button>
          )}

          {/* CT / MR segmented control */}
          <div style={track} data-tour="modality">
            {(['ct', 'mr'] as const).map(m => {
              const on = localModality === m;
              return (
                <button
                  key={m}
                  onClick={() => setLocalModality(m)}
                  style={{
                    padding: '6px 13px', borderRadius: 7,
                    fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
                    background: on ? (m === 'ct' ? PAL.ct : PAL.mr) : 'transparent',
                    color: on ? 'white' : 'var(--color-text-muted)',
                    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {m === 'mr' ? 'MRI' : 'CT'}
                </button>
              );
            })}
          </div>
        </div>

        {narrow && (
          <div style={track} role="group" aria-label="Show as">
            {([[false, 'Tiles', LayoutGrid], [true, 'List', List]] as const).map(([v, label, Icon]) => (
              <button key={label} onClick={() => setAsList(v)} aria-pressed={asList === v} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 600,
                background: asList === v ? 'var(--color-ink)' : 'transparent',
                color: asList === v ? '#fff' : 'var(--color-text-muted)', border: 'none', cursor: 'pointer',
              }}><Icon size={13} />{label}</button>
            ))}
          </div>
        )}

        {/* Order: the three everyday ones inline, the rest behind More — a row
            of eight measures is a wall, and seven of them are occasional. */}
        <div style={{ ...track, position: 'relative' }} ref={moreRef}>
          {primary.map(m => {
            const on = metric === m.key;
            return (
              <button key={m.key} onClick={() => setMetric(m.key)} title={m.label} style={{
                padding: '6px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 600,
                background: on ? 'var(--color-primary)' : 'transparent',
                color: on ? '#fff' : 'var(--color-text-muted)', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}>{m.short}</button>
            );
          })}
          <button
            onClick={() => setMoreOpen(o => !o)}
            aria-haspopup="menu" aria-expanded={moreOpen}
            title="Order by another measure"
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '6px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 600,
              background: activeExtra ? 'var(--color-primary)' : 'transparent',
              color: activeExtra ? '#fff' : 'var(--color-text-muted)',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}>
            {activeExtra ? activeExtra.short : 'More'}<ChevronDown size={12} />
          </button>
          {moreOpen && (
            <div role="menu" style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 40,
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 10, boxShadow: 'var(--shadow-lg)', padding: 5, minWidth: 176,
            }}>
              {extra.map(m => (
                <button key={m.key} role="menuitem"
                  onClick={() => { setMetric(m.key); setMoreOpen(false); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '7px 10px', borderRadius: 7, fontSize: 12,
                    fontWeight: metric === m.key ? 700 : 500,
                    background: metric === m.key ? 'var(--color-secondary)' : 'transparent',
                    color: 'var(--color-text-main)', border: 'none', cursor: 'pointer',
                  }}>{m.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <TileNav
          poolMode={poolMode}
          onSelectChapter={(chapter, additive) =>
            onSelectMany(chapterAggregates.get(chapter)?.codes ?? [], additive)}
          chapterAggregates={chapterAggregates}
          codeAggregates={codeAggregates}
          modality={localModality}
          metric={metric}
          activeChapter={activeChapter}
          activeCode={activeCode}
          selectedIds={selectedIds}
          onChapterClick={onChapterClick}
          onSelect={onSelect}
          asList={narrow && asList}
        />
      </div>
    </div>
  );
}
