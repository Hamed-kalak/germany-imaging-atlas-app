/**
 * SelectionTray — the pool a reader builds by hand, and everything that acts on
 * it: search, add a whole chapter, remove one. Clearing lives next to the Pool
 * button in the toolbar, where it does not need this opened first.
 *
 * It opens from a button rather than sitting under the treemap. As a permanent
 * strip it took about 110px off the tiles for a list that is only wanted when
 * something is being added to or removed from it.
 *
 * Search matters more than it looks: the treemap is the only other way in, and
 * finding "ischaemia" there means knowing it is chapter IX first. Here it is
 * one field, across all 624 diagnoses, regardless of chapter.
 */
import { useMemo, useState } from 'react';
import { CodeAggregate } from '../types';
import { CHAPTER_COLORS, SHORT_LABELS, PAL } from '../data/chapterMeta';
import { X, Layers, Search, CheckSquare, Square } from 'lucide-react';
import { useNarrow } from '../utils/useNarrow';

interface Props {
  selectedIds: string[];
  /** Every code in the filtered cohort — the search runs over all of them. */
  codeAggregates: Map<string, CodeAggregate>;
  /** The chapter currently open, if any, for "add all of it". */
  chapterCodes: string[];
  chapterName: string;
  /** Picked codes the active filters exclude — kept, but not drawn or counted. */
  hiddenCount: number;
  onToggle: (id: string) => void;
  onAddMany: (ids: string[]) => void;
  onShow: () => void;
  showing: boolean;
  onClose: () => void;
}

const MAX_RESULTS = 60;

export function SelectionTray({
  selectedIds, codeAggregates, chapterCodes, chapterName, hiddenCount,
  onToggle, onAddMany, onShow, showing, onClose,
}: Props) {
  const [query, setQuery] = useState('');
  // On a phone a popover under the button runs off the screen's edge; it
  // becomes a sheet above the tab bar instead.
  const narrow = useNarrow();
  const picked = useMemo(() => new Set(selectedIds), [selectedIds]);

  const rows = selectedIds
    .map(id => codeAggregates.get(id))
    .filter((c): c is CodeAggregate => !!c);
  const chapters = new Set(rows.map(r => r.chapter));

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: CodeAggregate[] = [];
    for (const c of codeAggregates.values()) {
      if (c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)) out.push(c);
      if (out.length >= MAX_RESULTS) break;
    }
    return out.sort((a, b) => a.code.localeCompare(b.code));
  }, [query, codeAggregates]);

  const chapterMissing = chapterCodes.filter(id => !picked.has(id));
  // "Everything" means every code the current filters leave in, not all 624
  // regardless — the pool and the treemap must agree, and a filtered-out code
  // is kept but never drawn or counted.
  const allMissing = [...codeAggregates.keys()].filter(id => !picked.has(id));
  const btn: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 600, background: 'transparent',
    border: '1px solid var(--color-border)', borderRadius: 6,
    padding: '4px 9px', cursor: 'pointer', color: 'var(--color-text-main)',
  };

  return (
    <div role="dialog" aria-label="Your pool" style={{
      ...(narrow
        ? { position: 'fixed', left: 8, right: 8, bottom: 'calc(70px + env(safe-area-inset-bottom))', zIndex: 300,
            maxHeight: '65dvh', overflowY: 'auto' as const }
        : { position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, width: 'min(460px, 84vw)' }),
      border: '1px solid var(--color-border)', borderRadius: 12,
      background: 'var(--color-surface)', boxShadow: 'var(--shadow-lg)',
      padding: '10px 12px 11px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Layers size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-main)' }}>
          Your pool · {rows.length} {rows.length === 1 ? 'diagnosis' : 'diagnoses'}
        </span>
        <span style={{ fontSize: 10.5, color: PAL.muted }}>
          {chapters.size === 0 ? '' : chapters.size === 1
            ? SHORT_LABELS[[...chapters][0]]?.replace(/­/g, '') ?? ''
            : `${chapters.size} chapters`}
        </span>
        <div style={{ flex: 1 }} />
        {!showing && rows.length >= 2 && (
          <button onClick={() => { onShow(); onClose(); }} style={{
            ...btn, color: '#fff', background: 'var(--color-primary)', border: 'none', fontWeight: 700,
          }}>Show these {rows.length}</button>
        )}
      </div>

      {/* A picked code the filters exclude is kept, not dropped — but it is not
          drawn or counted anywhere, so say so rather than let the pool and the
          treemap quietly disagree. */}
      {hiddenCount > 0 && (
        <div style={{
          fontSize: 10.5, lineHeight: 1.45, color: PAL.muted, marginBottom: 8,
          padding: '5px 8px', borderRadius: 7, background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
        }}>
          {hiddenCount} more {hiddenCount === 1 ? 'is' : 'are'} outside the current
          cohort and {hiddenCount === 1 ? 'is' : 'are'} not shown. Loosen the filters
          above to bring {hiddenCount === 1 ? 'it' : 'them'} back.
        </div>
      )}

      {/* Search across every diagnosis, not just the open chapter */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px',
        border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)',
      }}>
        <Search size={13} style={{ color: PAL.muted, flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all 624 — e.g. ischaemia, I21, fracture"
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: narrow ? 16 : 11.5, color: 'var(--color-text-main)', minWidth: 0,
          }}
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="Clear the search"
            style={{ display: 'flex', background: 'transparent', border: 'none', cursor: 'pointer', color: PAL.muted, padding: 0 }}>
            <X size={12} />
          </button>
        )}
      </div>

      {query.trim() !== '' && (
        <div style={{ maxHeight: 210, overflowY: 'auto', marginTop: 6 }}>
          {results.length === 0 && (
            <div style={{ fontSize: 11, color: PAL.muted, padding: '6px 2px' }}>
              Nothing matches “{query.trim()}”.
            </div>
          )}
          {results.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 2px 5px' }}>
              <span style={{ fontSize: 10, color: PAL.muted }}>
                {results.length}{results.length === MAX_RESULTS ? '+' : ''} matching
              </span>
              <button onClick={() => onAddMany(results.map(r => r.id))} style={btn}>
                Add all matching
              </button>
            </div>
          )}
          {results.map(r => {
            const on = picked.has(r.id);
            return (
              <button key={r.id} onClick={() => onToggle(r.id)} style={{
                display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left',
                padding: '5px 7px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: on ? 'var(--color-secondary)' : 'transparent',
              }}>
                {on ? <CheckSquare size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                    : <Square size={13} style={{ color: PAL.muted, flexShrink: 0 }} />}
                <span style={{
                  width: 6, height: 6, borderRadius: 3, flexShrink: 0,
                  background: CHAPTER_COLORS[r.chapter] ?? PAL.muted,
                }} />
                <span className="num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-main)', flexShrink: 0 }}>{r.code}</span>
                <span style={{ fontSize: 11, color: PAL.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* What is in the pool */}
      {query.trim() === '' && (
        <>
          <div style={{ display: 'flex', gap: 6, margin: '9px 0 7px', flexWrap: 'wrap' }}>
            {chapterCodes.length > 0 && chapterMissing.length > 0 && (
              <button onClick={() => onAddMany(chapterMissing)} style={btn}>
                {chapterMissing.length === chapterCodes.length
                  ? `Add all ${chapterCodes.length} in ${chapterName}`
                  : `Add the ${chapterMissing.length} left in ${chapterName}`}
              </button>
            )}
            {allMissing.length > 0 && (
              <button
                onClick={() => onAddMany(allMissing)}
                title="Every diagnosis the filters on the left leave in — the whole cohort in one pool"
                style={{ ...btn, borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
                {picked.size === 0
                  ? `Add everything · ${allMissing.length}`
                  : `Add the ${allMissing.length} not picked yet`}
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <div style={{ fontSize: 11, color: PAL.muted, lineHeight: 1.5, padding: '2px 0 4px' }}>
              {narrow ? (
                <>Nothing picked yet. Search above, or take a whole chapter or the
                  whole cohort with the buttons. The pool is kept while you move
                  between chapters.</>
              ) : (
                <>Nothing picked yet. Search above, take a whole chapter or the whole
                  cohort with the buttons, or ⌘/Ctrl-click tiles — a chapter tile adds
                  all of it. The pool is kept while you move between chapters.</>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 190, overflowY: 'auto' }}>
              {rows.map(r => (
                <span key={r.id} title={`${r.code} — ${r.title}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 5px 3px 8px', borderRadius: 'var(--radius-pill)',
                  background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                  fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-main)',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: 3, flexShrink: 0,
                    background: CHAPTER_COLORS[r.chapter] ?? PAL.muted,
                  }} />
                  {r.code}
                  <button
                    onClick={() => onToggle(r.id)}
                    aria-label={`Remove ${r.code} from the pool`}
                    style={{
                      display: 'flex', alignItems: 'center', background: 'transparent',
                      border: 'none', cursor: 'pointer', color: PAL.muted, padding: 0,
                    }}><X size={11} /></button>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
