/**
 * TileNav — zoomable treemap navigator (replaces BarNav).
 * Three internal states:
 *   general  — chapter tiles (size ∝ volume), click to zoom in
 *   detailed — code tiles of the active chapter, each with a left→right
 *              utilisation-trend gradient in the chapter's colour
 *   faded    — once codes are selected, unselected tiles dim
 * A Back control zooms out. Tiles drive App's existing drill/select handlers.
 */
import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { hierarchy, treemap } from 'd3';
import { ChapterAggregate, CodeAggregate } from '../types';
import { darken, SHORT_LABELS, CHAPTER_LABELS, CHAPTER_RANGES, CHAPTER_COLORS, PAL } from '../data/chapterMeta';

interface Props {
  chapterAggregates: Map<string, ChapterAggregate>;
  codeAggregates: Map<string, CodeAggregate>;
  modality: 'ct' | 'mr';
  metric: Metric;
  activeChapter: string | null;
  activeCode: string | null;
  selectedIds: string[];
  /** True while the pool is the subject: the tiles are then the pool itself,
   *  drawn from whatever chapters it spans, rather than the classification. */
  poolMode?: boolean;
  onChapterClick: (chapter: string) => void;
  onSelect: (id: string, additive?: boolean) => void;
  /** ⌘/Ctrl-click on a chapter tile: take the whole chapter into the selection. */
  onSelectChapter: (chapter: string, additive: boolean) => void;
  /** The same tiles as a ranked list -- the phone's alternative to tiles too small to tap. */
  asList?: boolean;
}

/** What the treemap is sized and ordered by. */
export type Metric = 'rate' | 'volume' | 'fraction' | 'ratio' | 'age' | 'elix' | 'vws';

export const TILE_METRICS: { key: Metric; label: string; short: string; primary: boolean }[] = [
  { key: 'rate', label: 'Utilisation rate', short: 'Rate', primary: true },
  { key: 'volume', label: 'Case volume', short: 'Vol', primary: true },
  { key: 'fraction', label: 'Multiple-code fraction', short: 'Multi-code %', primary: false },
  { key: 'ratio', label: 'Coded imaging intensity', short: 'Multi:single', primary: false },
  // "of the imaged" is the whole point of these three: over every admission the
  // CT and the MRI figure are the same number, so the name has to say which
  // population is being ranked.
  { key: 'age', label: 'Mean age of the imaged', short: 'Mean age', primary: false },
  { key: 'elix', label: 'Elixhauser count of the imaged', short: 'Elixhauser', primary: false },
  { key: 'vws', label: 'van Walraven score of the imaged', short: 'van Walraven', primary: false },
];
interface Tile {
  id: string;
  /** What the tile says. A chapter's name, or a diagnosis code. */
  label: string;
  /** The small line under it, where the tile is tall enough. */
  detail?: string;
  /** Full description, for the tooltip and the accessible name. */
  sub: string;
  /** Case count for this modality — shown in the tooltip either way. */
  volume: number;
  /** Utilisation rate for this modality. */
  rate: number;
  /** What the treemap sizes by. */
  size: number;
  /** The chosen measure, for the caption; null where nothing was released. */
  value: number | null;
  color: string;
  gradient?: string;
}

/**
 * What an unreleased year looks like. Fine diagonal stripes in a flat neutral:
 * unmistakably not a chapter colour, so it cannot be read as a value, and dark
 * enough that the white tile labels still clear 4.5:1 over it.
 */
const VOID_HATCH =
  'repeating-linear-gradient(45deg, #545c67 0, #545c67 4px, #495059 4px, #495059 8px)';

function fmt(v: number, metric: Metric): string {
  if (metric === 'rate' || metric === 'fraction') return `${v.toFixed(1)}%`;
  if (metric === 'ratio') return v.toFixed(2);
  if (metric === 'age') return `${v.toFixed(0)} yr`;
  if (metric === 'elix' || metric === 'vws') return v.toFixed(1);
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return String(Math.round(v));
}

/** The chosen measure for one code or chapter, for the tile's caption. */
function metricOf(a: any, metric: Metric, mod: 'ct' | 'mr'): number | null {
  switch (metric) {
    case 'rate': return mod === 'ct' ? a.ct_rate_overall : a.mr_rate_overall;
    case 'fraction': return mod === 'ct' ? a.ct_fraction : a.mr_fraction;
    case 'ratio': return mod === 'ct' ? a.ct_ratio : a.mr_ratio;
    // These read the imaged admissions of the chosen modality. They used to be
    // one modality-blind number, so switching CT/MR left the tiles the size and
    // the order they already were.
    case 'age': return mod === 'ct' ? a.ct_age : a.mr_age;
    case 'elix': return mod === 'ct' ? a.ct_elix : a.mr_elix;
    case 'vws': return mod === 'ct' ? a.ct_vws : a.mr_vws;
    default: return null;
  }
}

export function TileNav({
  chapterAggregates, codeAggregates, modality, metric,
  activeChapter, activeCode, selectedIds, poolMode = false,
  onChapterClick, onSelect, onSelectChapter, asList = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fx = useRef({ origin: '50% 40%', scale: 0.3 });   // zoom focus: tile centre + tile's size fraction
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<{ x: number; y: number; t: Tile } | null>(null);
  // Only a real pointer hovers. A tap fires mouseenter too, and on a phone the
  // card then stayed on screen over the tiles after the tap had done its work.
  const canHover = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: hover)').matches;

  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
    // asList: the treemap's box only exists while the tiles are showing.
  }, [asList]);

  // Chapter context: explicit drill, or the parent chapter of the selected code.
  const chapterCtx = poolMode
    ? null
    : activeChapter ?? (activeCode ? codeAggregates.get(activeCode)?.chapter ?? null : null);
  const drilled = !!chapterCtx || poolMode;
  const chAgg = chapterCtx ? chapterAggregates.get(chapterCtx) : undefined;
  const selSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  // Selections are always sets of CODES. At the chapter level a tile counts as
  // selected when any of its codes is, so selecting a whole chapter does not
  // fade every chapter tile out.
  const selChapters = useMemo(() => {
    const out = new Set<string>();
    for (const id of selectedIds) {
      const ch = codeAggregates.get(id)?.chapter;
      if (ch) out.add(ch);
    }
    return out;
  }, [selectedIds, codeAggregates]);

  const tiles: Tile[] = useMemo(() => {
    const vol = (ctV: number, mrV: number) => (modality === 'ct' ? ctV : mrV);
    // The pool is its own set of tiles. A pool assembled from four chapters has
    // no chapter to drill into, and showing the classification while the right
    // panel shows the pool put the two panels on different subjects.
    const codes = poolMode
      ? selectedIds.map(id => codeAggregates.get(id)).filter((c): c is CodeAggregate => !!c)
      : chAgg
        ? chAgg.codes.map(id => codeAggregates.get(id)).filter((c): c is CodeAggregate => !!c)
        : [];
    if (codes.length) {
      const rateMax = Math.max(10, ...codes.map(c => vol(c.ct_rate_overall, c.mr_rate_overall)));
      return codes.map(c => {
        // In the pool each tile keeps its own chapter's colour, which is the
        // only cue left that the set spans several.
        const base = poolMode ? (CHAPTER_COLORS[c.chapter] ?? PAL.ct) : chAgg!.color;
        const series = c.yearlyRates.map(y => (modality === 'ct' ? y.ct_rate : y.mr_rate));
        const n = series.length;
        // Left→right gradient: each year's rate → chapter-colour intensity
        // Low rate -> the chapter's own colour, high rate -> a deeper shade of
        // it, so darker reads as more, the way a heatmap is read.
        //
        // The original ran towards WHITE for low rates, which took the pale end
        // within a few percent of white and left the white label invisible.
        // Running towards ink instead keeps the conventional direction and
        // guarantees legibility: the palest any tile gets is the chapter colour,
        // which already clears 4.5:1 against white by construction.
        // A year the disclosure filter released nothing for gets NO colour: the
        // ramp stops and the tile's hatch shows through.
        //
        // It used to carry the previous year's shade across the gap, seeded at
        // zero. A diagnosis with one released MRI year out of twenty was then
        // painted pale for nineteen years and dark for one, which reads as a
        // spike in that year — F23 under MRI looked like a 2023 surge. Those
        // nineteen years were not low, they were unknown, and a tile that fills
        // itself edge to edge claims twenty years of evidence it does not have.
        const shade = (r: number) => darken(base, 0.55 * Math.max(0, Math.min(1, r / rateMax)));
        const pos = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 100);
        const stops: string[] = [];
        for (let i = 0; i < n; i++) {
          const r = series[i];
          const prev = i > 0 ? series[i - 1] : null;
          if (r != null) {
            // Coming out of a gap — a hard edge at the midpoint, so the colour
            // appears rather than fading in from nothing.
            if (i > 0 && prev == null) {
              const mid = (pos(i - 1) + pos(i)) / 2;
              stops.push(`transparent ${mid}%`, `${shade(r)} ${mid}%`);
            }
            stops.push(`${shade(r)} ${pos(i)}%`);
          } else if (i > 0 && prev != null) {
            // Going into one — hard edge again, and the ramp holds its last
            // released value only as far as the midpoint.
            const mid = (pos(i - 1) + pos(i)) / 2;
            stops.push(`${shade(prev)} ${mid}%`, `transparent ${mid}%`);
          }
        }
        // Nothing released at all: a wholly transparent ramp, so the tile is
        // the hatch and nothing else.
        if (!stops.length) stops.push('transparent 0%', 'transparent 100%');
        const volume = vol(c.ct_total, c.mr_total);
        const rate = vol(c.ct_rate_overall, c.mr_rate_overall);
        const value = metricOf(c, metric, modality);
        return {
          id: c.id, label: c.code, detail: c.title, sub: c.title,
          volume, rate, value,
          size: value == null ? volume : Math.max(0, value),
          color: base,
          gradient: `linear-gradient(90deg, ${stops.join(', ')})`,
        };
      });
    }
    // Chapter tiles carry the chapter's NAME. Roman numerals are what the
    // classification calls these, but "XVIII" tells a reader nothing; the
    // numeral and the code range go underneath and into the tooltip.
    return Array.from(chapterAggregates.values()).map(ch => {
      const volume = vol(ch.ct_total_all, ch.mr_total_all);
      const rate = vol(ch.ct_rate_overall, ch.mr_rate_overall);
      return {
        id: ch.chapter,
        label: SHORT_LABELS[ch.chapter] ?? ch.chapter,
        detail: `${ch.chapter} · ${CHAPTER_RANGES[ch.chapter] ?? ''}`,
        sub: CHAPTER_LABELS[ch.chapter] ?? ch.label,
        volume, rate, value: metricOf(ch, metric, modality),
        size: metricOf(ch, metric, modality) == null
          ? volume : Math.max(0, metricOf(ch, metric, modality)!),
        color: ch.color,
      };
    });
    // `metric` belongs here: it decides what `size` is, and therefore the
    // whole layout. Leaving it out made Rate/Vol change only the printed
    // number while the tiles kept their previous sizes and order.
  }, [chapterAggregates, codeAggregates, modality, metric, drilled, chAgg, poolMode, selectedIds]);

  // Treemap layout — fills the panel exactly (no scroll). Area ∝ sqrt of the
  // active metric, floored a little so small tiles don't vanish. d3's treemap
  // sorts by value, so switching CT/MR or Rate/Vol reorders as well as resizes.
  const { w, h } = dims;
  const layout = useMemo(() => {
    if (!w || !h || tiles.length === 0) return { nodes: [] as any[] };
    const sqrt = tiles.map(t => Math.sqrt(Math.max(t.size, 0)));
    const maxSqrt = Math.max(1, ...sqrt);
    const valued = tiles.map((t, i) => ({ ...t, area: Math.max(sqrt[i], maxSqrt * 0.18) }));
    const root = hierarchy<{ children: typeof valued }>({ children: valued } as any)
      .sum((d: any) => d.area || 0)
      .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
    treemap<any>().size([w, h]).paddingInner(4).paddingOuter(2).round(true)(root);
    // d3 returns the leaves in value order, and that order changes whenever the
    // metric or modality does. Rendering in that order means React reorders the
    // DOM nodes, and Chrome cancels an in-flight CSS transition on a node it has
    // just moved — which is why all but one tile used to jump straight to its
    // new place. The treemap decides geometry; the DOM order is fixed by id, so
    // every tile keeps its element and animates.
    return { nodes: root.leaves().sort((a: any, b: any) => (a.data.id < b.data.id ? -1 : 1)) };
  }, [tiles, w, h, metric]);

  const hasSelection = drilled ? selSet.size > 0 : selChapters.size > 0;

  const enterChapter = (id: string, x: number, y: number, tw: number, th: number) => {
    if (w && h) {
      fx.current.origin = `${(((x + tw / 2) / w) * 100).toFixed(1)}% ${(((y + th / 2) / h) * 100).toFixed(1)}%`;
      // the tile's footprint as a fraction of the panel (area-matched uniform scale)
      fx.current.scale = Math.max(0.05, Math.min(0.9, Math.sqrt((tw / w) * (th / h))));
    }
    onChapterClick(id);
  };

  // What a click does depends on where you are and whether a modifier is held:
  //   chapter tile, plain     -> drill into it
  //   chapter tile, ⌘/Ctrl    -> take the whole chapter into the selection
  //   diagnosis tile, plain   -> select it
  //   diagnosis tile, ⌘/Ctrl  -> add or remove it
  const activate = (id: string, additive: boolean, x: number, y: number, tw: number, th: number) => {
    if (drilled) return onSelect(id, additive);
    if (additive) return onSelectChapter(id, true);
    enterChapter(id, x, y, tw, th);
  };

  // ── Cinematic zoom between levels: the clicked tile is the camera focus.
  // Diving in, the chapter grid flies into the tile while the code grid unfolds
  // out of it; pulling out reverses. A short-lived "ghost" of the previous level
  // animates away so both motions are visible at once. transform-origin is the
  // clicked tile's centre (set in enterChapter, persisted across the in→out cycle).
  const curKey = chapterCtx ?? 'all';
  const lastRef = useRef<{ key: string; nodes: any[] }>({ key: curKey, nodes: [] });
  const transId = useRef(0);
  const [trans, setTrans] = useState<null | { enter: string; ghost: any[]; ghostAnim: string; origin: string; scale: number; id: number }>(null);
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useLayoutEffect(() => {
    const prev = lastRef.current;
    lastRef.current = { key: curKey, nodes: layout.nodes };
    if (prev.key === curKey || !prev.nodes.length || reduceMotion) return;
    const id = ++transId.current;
    setTrans({
      enter: drilled ? 'tileDiveIn' : 'tilePullIn',
      ghost: prev.nodes,
      ghostAnim: drilled ? 'tileDiveOut' : 'tilePullOut',
      origin: fx.current.origin,
      scale: fx.current.scale,
      id,
    });
    const timer = window.setTimeout(() => setTrans(cur => (cur && cur.id === id ? null : cur)), 780);
    return () => window.clearTimeout(timer);
  });

  const ANIM = '0.78s cubic-bezier(0.34, 0.08, 0.2, 1) both';
  // Deliberately slow: the point of the move is that a reader can follow one
  // diagnosis from its old place to its new one, and at half a second the eye
  // cannot track twenty tiles crossing at once.
  const REFLOW = '1.5s cubic-bezier(0.33, 0.1, 0.16, 1)';

  const renderTile = (node: any, interactive: boolean) => {
    const t: Tile = node.data;
    const x = node.x0, y = node.y0;
    const tw = node.x1 - node.x0, th = node.y1 - node.y0;
    const selected = drilled ? selSet.has(t.id) : selChapters.has(t.id);
    const faded = hasSelection && !selected;
    const showNum = tw >= 48 && th >= 38;
    const showLabel = tw >= 30 && th >= 26;
    // The second line (chapter numeral + range, or the diagnosis rubric) only
    // where there is genuinely room, so nothing is shown clipped.
    const showDetail = !!t.detail && tw >= 96 && th >= 52;
    // Every tile is dark enough for white text (see the lightness bands in
    // chapterMeta), so the label colour is fixed. The shadow is belt and
    // braces for the lightest chapters.
    const shadow = '0 1px 2px rgba(0,0,0,0.45)';
    // Chapter names are long ("Musculoskeletal", "Genitourinary") and tiles are
    // sized by data, not by label. Step the type down on narrow tiles and let
    // the name wrap, rather than clipping it to "Musculosl".
    const labelSize = drilled ? 12 : tw >= 150 ? 14 : tw >= 112 ? 13 : tw >= 86 ? 12 : 11;
    // No released cells for this modality is not the same as no imaging: the
    // disclosure filter drops a year x code x sex cell below 100 cases, and the
    // Article never counts those as zero. Print an em dash, not "0.0%".
    const noData = t.volume <= 0;
    return (
      <div
        key={t.id}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : -1}
        aria-hidden={interactive ? undefined : true}
        /* No `title`: the browser's own tooltip fired on top of the hover card
           below, so a tile showed the same name twice, once in each style. The
           card carries everything the title did, including the no-data line.
           Elsewhere in the app a native title is still the right control. */
        aria-label={interactive
          ? noData
            ? `${t.sub} — no ${modality.toUpperCase()} data released`
            : `${t.sub} — ${fmt(t.rate, 'rate')}, ${fmt(t.volume, 'volume')} cases`
          : undefined}
        onClick={interactive ? (e) => activate(t.id, e.ctrlKey || e.metaKey, x, y, tw, th) : undefined}
        onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(t.id, e.ctrlKey || e.metaKey, x, y, tw, th); } } : undefined}
        onMouseEnter={interactive && canHover ? (e) => setHover({ x: e.clientX, y: e.clientY, t }) : undefined}
        onMouseMove={interactive && canHover ? (e) => setHover({ x: e.clientX, y: e.clientY, t }) : undefined}
        onMouseLeave={interactive && canHover ? () => setHover(null) : undefined}
        style={{
          position: 'absolute', left: x, top: y, width: tw, height: th,
          // The ramp sits ON the hatch: wherever a year released nothing the ramp
          // is transparent there, and the hatch is what shows.
          background: t.gradient ? `${t.gradient}, ${VOID_HATCH}` : t.color,
          borderRadius: 6, cursor: interactive ? 'pointer' : 'default', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: showLabel ? '5px 7px' : 0,
          // 0.38 washed the (already light) tiles out to near-blank once
          // anything was selected; 0.55 still reads as de-emphasised.
          opacity: faded ? 0.5 : 1,
          outline: selected ? '2px solid var(--color-text-main)' : 'none', outlineOffset: -2,
          boxShadow: selected ? 'var(--shadow-md)' : 'none',
          // Position and size are transitioned so that switching CT/MRI or
          // Rate/Volume MOVES each tile to its new place instead of repainting
          // the grid: React keys tiles by code, so the same DOM node travels and
          // a reader can follow one diagnosis across the change. Newly mounted
          // tiles (drilling in or out) have no previous value to animate from,
          // so the level transition is unaffected.
          transition: reduceMotion ? 'none' : `left ${REFLOW}, top ${REFLOW}, `
            + `width ${REFLOW}, height ${REFLOW}, background 0.5s ease, `
            + 'opacity 0.45s cubic-bezier(0.22,0.68,0.24,1), outline-color 0.25s, box-shadow 0.3s',
          color: '#ffffff', pointerEvents: interactive ? undefined : 'none',
        }}
      >
        {showLabel && (
          <span style={{ display: 'block', minWidth: 0 }}>
            {/* Chapter names wrap to two lines on narrow tiles rather than
                truncating to "Peri…"; diagnosis codes never need to. */}
            <span className={drilled ? 'num' : undefined} style={{
              fontSize: labelSize, fontWeight: 700,
              textShadow: shadow, lineHeight: 1.15, overflow: 'hidden',
              ...(drilled || th < 34
                ? { display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }
                : {
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as const,
                    overflowWrap: 'break-word' as const, hyphens: 'auto' as const,
                  }),
            }}>
              {t.label}
            </span>
            {showDetail && (
              <span style={{
                display: 'block', fontSize: labelSize - 3, fontWeight: 500, marginTop: 2,
                opacity: 0.85, textShadow: shadow, lineHeight: 1.25,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {t.detail}
              </span>
            )}
          </span>
        )}
        {showNum && (
          <span className="num" style={{ fontSize: 11.5, fontWeight: 700, alignSelf: 'flex-start', textShadow: shadow, opacity: noData ? 0.7 : 1 }}>
            {noData ? '—'
              : metric === 'volume' ? fmt(t.volume, 'volume')
              : t.value == null ? '—' : fmt(t.value, metric)}
          </span>
        )}
      </div>
    );
  };

  if (asList) {
    // Ranked by what the tiles are sized by, largest first, so the list reads
    // in the order the treemap draws. Each row carries the tile's own colour.
    const ranked = [...tiles].sort((a, b) => b.size - a.size);
    const top = Math.max(1e-9, ...ranked.map(t => (metric === 'volume' ? t.volume : t.value ?? 0)));
    return (
      <div role="list" style={{ height: '100%', overflowY: 'auto', padding: '4px 8px 8px', overscrollBehavior: 'contain' }}>
        {ranked.map(t => {
          const selected = drilled ? selSet.has(t.id) : selChapters.has(t.id);
          const noData = t.volume <= 0;
          const v = metric === 'volume' ? t.volume : t.value;
          return (
            <button key={t.id} type="button" role="listitem"
              onClick={() => activate(t.id, false, 0, 0, 0, 0)}
              style={{
                display: 'grid', gridTemplateColumns: '6px minmax(0, 1fr) auto', columnGap: 10, alignItems: 'center',
                width: '100%', textAlign: 'left', padding: '9px 8px', minHeight: 52,
                borderBottom: '1px solid var(--color-border)',
                background: selected ? 'var(--color-secondary)' : 'transparent',
              }}>
              <span style={{ alignSelf: 'stretch', borderRadius: 3, background: t.color }} />
              <span style={{ minWidth: 0 }}>
                <span className={drilled ? 'num' : undefined} style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--color-text-main)' }}>
                  {t.label.replace(/­/g, '')}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {drilled ? t.sub : t.detail}
                </span>
                <span style={{ display: 'block', height: 4, borderRadius: 2, marginTop: 5, background: 'var(--color-bg)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${noData || v == null ? 0 : Math.max(2, (v / top) * 100)}%`, background: t.color }} />
                </span>
              </span>
              <span className="num" style={{ fontSize: 13, fontWeight: 700, color: noData ? 'var(--color-text-muted)' : 'var(--color-text-main)' }}>
                {noData || v == null ? '—' : fmt(v, metric)}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Treemap fills the panel — no scroll. Diving into a tile zooms the camera. */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '0 8px 8px' }}>
       <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* exiting ghost of the previous level — flies into / out of the tile */}
        {trans && (
          <div key={`ghost-${trans.id}`} aria-hidden className="tile-anim"
            style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', transformOrigin: trans.origin, animation: `${trans.ghostAnim} ${ANIM}`, ['--t-in' as any]: trans.scale, ['--t-out' as any]: Math.min(16, 1 / trans.scale) }}>
            {trans.ghost.map((node: any) => renderTile(node, false))}
          </div>
        )}
        {/* active level — unfolds out of / pulls back to the tile */}
        <div key={`${curKey}-${trans?.id ?? 0}`} className="tile-anim"
          style={{ position: 'absolute', inset: 0, zIndex: 2, transformOrigin: trans?.origin ?? fx.current.origin, animation: trans ? `${trans.enter} ${ANIM}` : undefined, ['--t-in' as any]: trans?.scale ?? 0.3, ['--t-out' as any]: trans ? Math.min(16, 1 / trans.scale) : 2.7 }}>
          {layout.nodes.map((node: any) => renderTile(node, true))}
        </div>
       </div>
      </div>

      {hover && (
        <div style={{
          position: 'fixed', left: hover.x + 12, top: hover.y + 12, zIndex: 1000,
          background: 'var(--color-text-main)', color: 'var(--color-surface)', padding: '7px 10px',
          borderRadius: 6, fontSize: 11, pointerEvents: 'none', maxWidth: 260, boxShadow: 'var(--shadow-md)',
        }}>
          <div style={{ fontWeight: 700 }}>{hover.t.label}{hover.t.sub && hover.t.sub !== hover.t.label ? ` · ${hover.t.sub}` : ''}</div>
          {hover.t.volume <= 0 ? (
            <div style={{ opacity: 0.85, marginTop: 2 }}>
              No {modality.toUpperCase()} cells released — every year here fell below the
              disclosure threshold. Suppressed is not zero.
            </div>
          ) : (
            <div className="num" style={{ opacity: 0.85, marginTop: 2 }}>
              {hover.t.rate.toFixed(1)}% {modality.toUpperCase()} utilisation · {fmt(hover.t.volume, 'volume')} cases
            </div>
          )}
          {drilled && <div style={{ opacity: 0.7, marginTop: 2, fontSize: 10 }}>Click to open · ⌘/Ctrl-click to add</div>}
        </div>
      )}
    </div>
  );
}

