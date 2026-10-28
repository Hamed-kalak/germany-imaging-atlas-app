import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar.tsx';
import { FilterPanel } from './components/FilterPanel.tsx';
import { NavigationPanel } from './components/NavigationPanel.tsx';
import { ComparisonPanel } from './components/ComparisonPanel.tsx';
import { Breadcrumb } from './components/Breadcrumb.tsx';
import { DatasetPopup } from './components/DatasetPopup.tsx';
import { AboutPill } from './components/AboutPill.tsx';
import { GuidedTour } from './components/GuidedTour.tsx';
import { PhoneTabs, type PhoneView } from './components/PhoneTabs.tsx';
import { useNarrow } from './utils/useNarrow.ts';
import { BRAND } from './data/brand.ts';
import { CHAPTER_RANGES, SHORT_LABELS, CHAPTER_LABELS } from './data/chapterMeta.ts';
import { BarChart3, ChevronRight } from 'lucide-react';

// Observations for one code, summed over its (possibly year-trimmed) trends —
// so the stat reflects the active year window, not the full-range meta.
function obsOf(d: IcdData): number {
  // Hospital cases: the whole denominator — not-imaged, single and multiple.
  //
  // This used to add the CT and MRI SINGLE-code counts and nothing else, and
  // the header reported the result as "51.8M obs". That left out 35.3M
  // multiple-code admissions and all 232.9M that were never imaged, so the
  // headline figure for a 297.4M-case census was a sixth of it, under a word
  // that does not appear in the Article. CT and MRI are separate tabulations of
  // the same admissions, so they are never added. The CT analysis set is the
  // one the Article counts (297.4M), so that is the denominator here, falling
  // back to the MRI table for the 17 codes that released no CT at all.
  let ct = 0, mr = 0;
  for (const t of d.trends as any[]) {
    ct += (t.ct_count_no_male || 0) + (t.ct_count_no_female || 0)
        + (t.ct_count_male || 0) + (t.ct_count_female || 0)
        + (t.ct_multiple_male || 0) + (t.ct_multiple_female || 0);
    mr += (t.mr_count_no_male || 0) + (t.mr_count_no_female || 0)
        + (t.mr_count_male || 0) + (t.mr_count_female || 0)
        + (t.mr_multiple_male || 0) + (t.mr_multiple_female || 0);
  }
  return ct > 0 ? ct : mr;
}
const statsFrom = (arr: IcdData[]) => ({ count: arr.length, obs: arr.reduce((a, d) => a + obsOf(d), 0) });

// Leading "where to start" screen — shown on the right until a chapter or a
// diagnosis is picked. It explains the one thing a reader has to know before
// any chart here means anything: what none / single / multiple count.
function SelectPrompt({ narrow = false }: { narrow?: boolean }) {
  const head = 'var(--color-text-main)';
  const sub = 'var(--color-text-muted)';
  const groups: [string, string, string][] = [
    ['None', BRAND.blue, 'no procedure code for that modality'],
    ['Single', BRAND.teal, 'exactly one code'],
    ['Multiple', BRAND.amber, 'more than one code'],
  ];
  return (
    <div className="card" style={{
      height: narrow ? 'auto' : '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '28px 32px',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: head, letterSpacing: '-0.01em' }}>
        Select a chapter to explore
      </div>
      <div style={{ fontSize: 13, marginTop: 10, lineHeight: 1.6, color: sub, maxWidth: 420 }}>
        Pick an ICD-10-GM chapter {narrow ? 'on the Explore tab' : 'on the left'} to zoom in, then choose a diagnosis to see
        how often it was imaged, how that changed over twenty years, and who was imaged.
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 30, flexWrap: 'wrap', justifyContent: 'center' }}>
        {groups.map(([label, colour, what]) => (
          <div key={label} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5,
            padding: '11px 14px', borderRadius: 10, minWidth: 148, textAlign: 'left',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: colour, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: head }}>{label}</span>
            </div>
            <span style={{ fontSize: 10.5, lineHeight: 1.45, color: sub }}>{what}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, marginTop: 22, color: sub, maxWidth: 440, lineHeight: 1.55 }}>
        German OPS procedure codes are region-specific, so one acquisition covering
        several regions can produce several codes. <b>Multiple</b> counts the procedure
        codes recorded for one admission — an upper bound on separate examinations,
        not a count of repeat imaging.
      </div>
    </div>
  );
}
import { loadData } from './data/dataLoader.ts';
import { loadGroups, saveGroups } from './utils/savedGroups.ts';
import { computeChapterAggregates, computeCodeAggregates, computeOverallYearly } from './data/aggregations.ts';
import { FilterState, DrillLevel, CodeGroup, GROUP_PALETTE } from './types.ts';
import type { IcdData } from './data/dataLoader.ts';

function App({ tourSignal = 0 }: { tourSignal?: number }) {
  // Data is fetched at runtime (the dataset is a separate asset, not bundled).
  const [allData, setAllData] = useState<IcdData[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    loadData().then(setAllData).catch(e => setLoadError(String(e?.message || e)));
  }, []);

  // The guided tour: requested from the landing page (Root bumps tourSignal)
  // or the Tour button. It waits for the data, since it points at the panels.
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    if (tourSignal > 0 && allData) setTourOpen(true);
  }, [tourSignal, allData]);
  const closeTour = useCallback(() => setTourOpen(false), []);

  // Phone width: one panel at a time, switched by a tab bar (see utils/useNarrow
  // and components/PhoneTabs). The handlers below read the ref, since they are
  // memoised once.
  const narrow = useNarrow();
  const narrowRef = useRef(narrow);
  narrowRef.current = narrow;
  const [phoneView, setPhoneView] = useState<PhoneView>('explore');
  const showCharts = () => { if (narrowRef.current) setPhoneView('charts'); };
  const chartsRef = useRef<HTMLDivElement>(null);
  // The tour starts at the tiles, so on a phone it starts on Explore.
  useEffect(() => { if (tourOpen && narrow) setPhoneView('explore'); }, [tourOpen, narrow]);
  const ALL_DATA = allData ?? [];

  const [filters, setFilters] = useState<FilterState>({
    minObsPerYear: 1000,
    minYears: 15,
    yearRange: null,
  });

  // Min/max year present in the dataset (drives the year-range filter bounds).
  const yearBounds = useMemo<[number, number] | null>(() => {
    let lo = Infinity, hi = -Infinity;
    for (const d of ALL_DATA) for (const t of d.trends) {
      if (t.year < lo) lo = t.year;
      if (t.year > hi) hi = t.year;
    }
    return isFinite(lo) ? [lo, hi] : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allData]);

  // Trim a code's yearly trends to the active year window. Returns the input
  // unchanged when the window covers (or exceeds) the full dataset range.
  const trimToYears = useCallback((data: IcdData[]): IcdData[] => {
    const yr = filters.yearRange;
    if (!yr) return data;
    if (yearBounds && yr[0] <= yearBounds[0] && yr[1] >= yearBounds[1]) return data;
    const [lo, hi] = yr;
    return data.map(d => ({ ...d, trends: d.trends.filter(t => t.year >= lo && t.year <= hi) }));
  }, [filters.yearRange, yearBounds]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /** The code under the cursor in the comparison, so its tile can light up. */
  const [hoverCodeId, setHoverCodeId] = useState<string | null>(null);
  const [drillLevel, setDrillLevel] = useState<DrillLevel>({ level: 'all' });
  /**
   * What the right panel is about. Browsing a chapter and building a pool are
   * different intents, and the pool must outlive navigation — otherwise a pool
   * drawn from several chapters is impossible, since reaching the second
   * chapter destroys what you picked in the first.
   */
  const [subject, setSubject] = useState<'browse' | 'pool'>('browse');
  /**
   * Whether the TREEMAP is the pool, as distinct from the right panel being
   * about it. Only "Show these N" in the pool popover turns this on.
   *
   * One flag used to do both, so ⌘-clicking a third diagnosis inside a chapter
   * collapsed the chapter's forty tiles down to the three picked — the tiles
   * you were selecting from vanished mid-selection. Selecting in a chapter now
   * leaves the chapter on screen; the pool takes the treemap over only when
   * asked for explicitly.
   */
  const [poolTiles, setPoolTiles] = useState(false);
  const [datasetOpen, setDatasetOpen] = useState(false);
  // A new subject opens Charts at its top, not wherever the last one was scrolled to.
  useEffect(() => { chartsRef.current?.scrollTo({ top: 0 }); }, [selectedIds, drillLevel]);

  // The About panel links to the landing and legal pages; leaving the atlas closes it.
  useEffect(() => {
    const close = () => setDatasetOpen(false);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, []);

  // Custom groups. Storage is namespaced, validated and never throws — see
  // utils/savedGroups for why each of those matters on a shared server.
  const [savedGroups, setSavedGroups] = useState<CodeGroup[]>(loadGroups);

  const handleSaveGroup = useCallback((name: string, codeIds: string[]) => {
    setSavedGroups(prev => {
      const color = GROUP_PALETTE[prev.length % GROUP_PALETTE.length];
      const next = [...prev, { id: `g_${Date.now()}`, name, codeIds, color }];
      saveGroups(next);
      return next;
    });
  }, []);

  const handleDeleteGroup = useCallback((groupId: string) => {
    setSavedGroups(prev => {
      const next = prev.filter(g => g.id !== groupId);
      saveGroups(next);
      return next;
    });
  }, []);

  // Filtering Logic
  const filteredData = useMemo(() => {
    return ALL_DATA.filter(d => {
      if (filters.minObsPerYear != null) {
        const years = Math.max(1, Number(d.meta.years_covered) || 1);
        const avgPerYear = (Number(d.meta.n_total) || 0) / years;
        if (avgPerYear < filters.minObsPerYear) return false;
      }
      if (d.meta.years_covered < filters.minYears) return false;
      return true;
    });
  }, [filters, allData]);

  // Year-windowed view of the filtered codes (drives all utilization-trend views).
  const viewData = useMemo(() => trimToYears(filteredData), [filteredData, trimToYears]);

  // Filtered aggregations — recomputed when filters (incl. year range) change
  const filteredChapterAggs = useMemo(() => computeChapterAggregates(viewData), [viewData]);
  const filteredCodeAggs = useMemo(() => computeCodeAggregates(viewData), [viewData]);
  // Live ref to the code→chapter map, so selection handlers can find a code's
  // chapter without going stale (they're memoised with empty deps).
  const codeAggsRef = useRef(filteredCodeAggs);
  codeAggsRef.current = filteredCodeAggs;
  // Full dataset, all years — feeds the static Dataset overview popup (filter-independent).
  const fullOverallYearly = useMemo(() => computeOverallYearly(ALL_DATA), [allData]);
  // Whole filtered dataset, observations summed over the active year window.
  const stats = useMemo(() => statsFrom(viewData), [viewData]);

  // Context-aware stats — reflect what's currently in view (also year-windowed):
  // selected code(s) › drilled chapter › the whole filtered set.
  const contextStats = useMemo(() => {
    if (selectedIds.length > 0) {
      const sel = viewData.filter(d => selectedIds.includes(d.id));
      const src = sel.length ? sel : trimToYears(ALL_DATA.filter(d => selectedIds.includes(d.id)));
      if (src.length) return { ...statsFrom(src), scope: src.length === 1 ? 'code' as const : 'codes' as const };
    }
    if (drillLevel.level === 'chapter') {
      return { ...statsFrom(viewData.filter(d => d.chapter === drillLevel.chapter)), scope: 'chapter' as const };
    }
    return { ...stats, scope: 'all' as const };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, drillLevel, viewData, stats, trimToYears, allData]);

  const filteredIdSet = useMemo(() => {
    return new Set(filteredData.map(d => d.id));
  }, [filteredData]);

  // Selection Handlers — unified (no mode toggle)
  // Plain click = replace, Ctrl/Cmd+click = additive toggle
  const handleSelect = useCallback((id: string, additive?: boolean) => {
    setSubject('pool');
    if (!id) { setSelectedIds([]); setDrillLevel({ level: 'all' }); return; }
    if (additive) {
      setSelectedIds(prev => {
        const next = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id];
        // Stay in the code's chapter (detailed tiles) for any non-single result,
        // so the tiles don't collapse back to the general view mid-selection.
        const ch = codeAggsRef.current.get(id)?.chapter;
        const stay = (): DrillLevel => (ch ? { level: 'chapter', chapter: ch } : { level: 'all' });
        if (next.length === 1) setDrillLevel({ level: 'code', codeId: next[0] });
        else setDrillLevel(stay());
        return next;
      });
    } else {
      setPoolTiles(false);
      setSelectedIds(prev => {
        const deselect = prev.includes(id) && prev.length === 1;
        if (deselect) {
          // Re-clicking the selected tile just deselects it, staying in the
          // detailed tiles of its chapter (not back out to all chapters).
          const ch = codeAggsRef.current.get(id)?.chapter;
          setDrillLevel(ch ? { level: 'chapter', chapter: ch } : { level: 'all' });
          return [];
        }
        setDrillLevel({ level: 'code', codeId: id });
        showCharts();
        return [id];
      });
    }
  }, []);

  const handleSearch = useCallback((id: string) => {
    if (!id) { setSelectedIds([]); return; }
    setDrillLevel({ level: 'code', codeId: id });
    setSelectedIds([id]);
    showCharts();
  }, []);

  const handleHeaderPick = useCallback((id: string) => {
    if (!id) return;
    setDrillLevel({ level: 'code', codeId: id });
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }, []);

  /**
   * Take a whole set of codes into the selection — a chapter's worth, or a
   * chapter added to what is already selected.
   *
   * `additive` false replaces the selection with `ids`; true unions them in, or
   * removes them when every one is already selected, so ⌘-clicking a chapter
   * tile twice undoes it. The drill level is left where it is: with two or more
   * codes selected the right panel shows the comparison regardless, and moving
   * the tiles out from under the user mid-selection is disorienting.
   */
  const handleSelectMany = useCallback((ids: string[], additive: boolean) => {
    if (!ids.length) return;
    setSubject('pool');
    setSelectedIds(prev => {
      if (!additive) return [...ids];
      const have = new Set(prev);
      const next = ids.every(id => have.has(id))
        ? prev.filter(id => !ids.includes(id))
        : [...prev, ...ids.filter(id => !have.has(id))];
      if (next.length === 1) setDrillLevel({ level: 'code', codeId: next[0] });
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
    setSubject('browse');
    setPoolTiles(false);
  }, []);

  /** The tray's "Show these N" — for a pool assembled by ⌘-clicking tiles. */
  const handleShowPool = useCallback(() => { setSubject('pool'); setPoolTiles(true); }, []);

  /**
   * Adding from the pool popover — by search, by chapter, or by ticking a
   * result. Unlike ⌘-clicking a tile this takes the treemap over immediately:
   * searching "ischaemia" and adding four codes is working ON the pool, not
   * browsing the classification, so leaving the tiles on whatever chapter
   * happened to be open and waiting for a separate "Show these N" was a step
   * with no decision in it.
   */
  const poolTake = (next: string[]) => {
    setSubject('pool');
    setPoolTiles(next.length >= 2);
    return next;
  };

  const handlePoolAdd = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setSelectedIds(prev => {
      const have = new Set(prev);
      return poolTake([...prev, ...ids.filter(id => !have.has(id))]);
    });
  }, []);

  const handlePoolToggle = useCallback((id: string) => {
    setSelectedIds(prev => poolTake(
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));
  }, []);

  const handleChapterClick = useCallback((chapter: string) => {
    // Empty chapter = "back to all chapters" (the Back button passes '').
    // The pool is deliberately left alone: navigation is how you reach the next
    // chapter to add from.
    setDrillLevel(chapter ? { level: 'chapter', chapter } : { level: 'all' });
    setSubject('browse');
    setPoolTiles(false);
  }, []);

  const handleCodeClick = useCallback((codeId: string) => {
    setDrillLevel({ level: 'code', codeId });
    setSelectedIds([codeId]);
    showCharts();
  }, []);

  const handleBreadcrumbNavigate = useCallback((level: DrillLevel) => {
    setDrillLevel(level);
    if (level.level === 'all') setSelectedIds([]);
  }, []);


  /**
   * The pool as the current cohort actually holds it.
   *
   * This used to read from ALL_DATA, while the tiles, the ranking and the
   * heatmap read from the filtered aggregates — so tightening the cases-a-year
   * filter left the panel saying "3 codes" over a two-code chapter breakdown
   * and a two-tile treemap, with the trends pooled over all three. A code the
   * filters exclude stays in the pool, and loosening them brings it back, but
   * while it is out of cohort nothing counts, draws or pools it.
   */
  const selectedData = useMemo(
    () => viewData.filter(d => selectedIds.includes(d.id)),
    [viewData, selectedIds]);

  const sunburstModality: 'ct' | 'mr' = 'ct';

  // Counted over what is drawable, not over what was picked: a pool whose
  // members the filters have excluded must not route to a panel with nothing
  // in it.
  const shownCount = selectedData.length;
  const isMultiSelect = shownCount >= 2;

  // A code or a comparison is showing — keys the left-to-right reveal.
  const trendsMode = drillLevel.level === 'code' || isMultiSelect;

  // Right panel content
  //
  // One panel for every subject — a diagnosis, a pool, a chapter. The route in
  // decides the words and which mode opens first, never the layout: a single
  // diagnosis used to be a different component with no Pooled/Compare switch at
  // all, so picking one tile made the mode control vanish.
  const renderRightPanel = () => {
    const panel = (p: {
      data: IcdData[]; chip: string; name: string; note?: string;
      pooledTitle: string; open: 'pooled' | 'compare';
    }) => (
      <ComparisonPanel
        selectedData={p.data}
        codeAggregates={filteredCodeAggs}
        label={p.name}
        sublabel={p.note}
        pooledCode={p.chip}
        pooledTitle={p.pooledTitle}
        defaultTab={p.open}
        hoverCodeId={hoverCodeId}
        onHoverCode={setHoverCodeId}
      />
    );

    // A pool of two or more wins only while it is the subject; plainly opening
    // a chapter means "show me this chapter", with the pool waiting in the tray.
    if (isMultiSelect && subject === 'pool') {
      const chs = [...new Set(selectedData.map(d => d.chapter))];
      const only = chs.length === 1 ? chs[0] : null;
      // The codes themselves, never a range. Picking R56 and R93 used to be
      // chipped "R00–R99" — the whole of chapter XVIII, forty-odd diagnoses the
      // reader did not choose and is not looking at. A range belongs to the
      // chapter route below, where the subject really is the range.
      const MAX = 6;
      const listed = selectedData.slice(0, MAX).map(d => d.code).join(' · ');
      const rest = selectedData.length - MAX;
      return panel({
        data: selectedData,
        chip: 'Your pool',
        name: rest > 0 ? `${listed} +${rest} more` : listed,
        note: only
          ? `${(SHORT_LABELS[only] ?? only).replace(/\u00AD/g, '')} — chapter ${only} (${CHAPTER_RANGES[only] ?? only})`
          : `Picked by hand from ${chs.length} chapters`,
        pooledTitle: `${selectedData.length} selected diagnoses, pooled`,
        open: 'compare',
      });
    }

    // Before the chapter, not after it: searching one code into the pool while
    // standing in some other chapter used to leave that chapter on screen, so
    // the thing you had just picked was the one thing not shown.
    if (shownCount === 1 && (drillLevel.level === 'code' || subject === 'pool')) {
      const d = selectedData[0];
      return panel({
        data: selectedData,
        chip: d.code,
        name: d.title,
        note: CHAPTER_LABELS[d.chapter] ?? d.chapter,
        pooledTitle: d.title,
        open: 'pooled',
      });
    }

    if (drillLevel.level === 'chapter') {
      const ch = drillLevel.chapter;
      const members = viewData.filter(d => d.chapter === ch);
      if (members.length) {
        const name = (SHORT_LABELS[ch] ?? ch).replace(/\u00AD/g, '');
        return panel({
          data: members,
          chip: CHAPTER_RANGES[ch] ?? ch,
          name: `${name} — chapter ${ch}`,
          note: CHAPTER_LABELS[ch] ?? `Chapter ${ch}`,
          pooledTitle: `${name} — chapter ${ch}, ${members.length} diagnoses pooled`,
          open: 'pooled',
        });
      }
    }

    // Default (general level): prompt the user to pick a tile.
    return <SelectPrompt narrow={narrow} />;
  };

  // What the phone's Charts tab is about, in a few characters.
  const chartsLabel = (() => {
    if (isMultiSelect && subject === 'pool') return `${shownCount} pooled`;
    if (shownCount === 1 && (drillLevel.level === 'code' || subject === 'pool')) return selectedData[0].code;
    if (drillLevel.level === 'chapter') return (SHORT_LABELS[drillLevel.chapter] ?? drillLevel.chapter).replace(/­/g, '');
    return '';
  })();

  // Loading / error gate (all hooks above run unconditionally)
  if (loadError) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 8, color: 'var(--color-text-muted)' }}>
        <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>Could not load data</div>
        <div style={{ fontSize: 13 }}>{loadError}</div>
      </div>
    );
  }
  if (!allData) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 14 }}>
        <div className="icd-spinner" />
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 500 }}>
          Loading imaging data…
        </div>
        <style>{`
          .icd-spinner { width: 34px; height: 34px; border-radius: 50%;
            border: 3px solid var(--color-border, #e2e8f0);
            border-top-color: var(--color-primary, #2563eb);
            animation: icd-spin 0.8s linear infinite; }
          @keyframes icd-spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // The tiles card: beside the charts on a desktop, the Explore tab on a phone.
  const leftPanel = (
    <div className="card" style={{
      display: 'flex', flexDirection: 'column',
      width: '100%', height: '100%', overflow: 'hidden', padding: 0
    }}>
      {/* Band 1 — breadcrumb location + Dataset link */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 11, width: '100%',
        padding: '12px 16px', flexShrink: 0, borderBottom: '1px solid var(--color-border)',
      }}>
        <button
          type="button" onClick={() => setDatasetOpen(true)} aria-haspopup="dialog" aria-label="Open about"
          style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: 'var(--color-secondary)',
            color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <BarChart3 size={17} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Breadcrumb
            drillLevel={drillLevel}
            codeAggregates={filteredCodeAggs}
            onNavigate={handleBreadcrumbNavigate}
            poolCount={poolTiles && isMultiSelect ? shownCount : undefined}
          />
        </div>
        <button
          type="button" onClick={() => setDatasetOpen(true)} aria-haspopup="dialog"
          style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}
        >
          About <ChevronRight size={14} />
        </button>
      </div>

      {/* Bands 2 + 3 — stat row, Paper/All, cohort filters */}
      <div style={{ flexShrink: 0 }}>
        <FilterPanel filters={filters} onChange={setFilters} stats={stats} viewStats={contextStats} yearBounds={yearBounds} embedded={true} collapsible={narrow} />
      </div>
      <div data-tour="treemap" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <NavigationPanel
          chapterAggregates={filteredChapterAggs}
          codeAggregates={filteredCodeAggs}
          modality={sunburstModality}
          drillLevel={drillLevel}
          onChapterClick={handleChapterClick}
          onCodeClick={handleCodeClick}
          filteredData={filteredData}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onSelectMany={handleSelectMany}
          onClearSelection={handleClearSelection}
          onShowPool={handleShowPool}
          onPoolToggle={handlePoolToggle}
          onPoolAddMany={handlePoolAdd}
          poolShowing={poolTiles && isMultiSelect}
          poolMode={poolTiles && isMultiSelect}
          onGroupSelect={(ids) => {
            setSelectedIds(ids);
                      if (ids.length === 1) setDrillLevel({ level: 'code', codeId: ids[0] });
            else setDrillLevel({ level: 'all' });
          }}
          savedGroups={savedGroups}
          onSaveGroup={handleSaveGroup}
          onDeleteGroup={handleDeleteGroup}
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Header */}
      <div style={{ height: narrow ? 'auto' : '56px', position: 'relative', zIndex: 50, flexShrink: 0 }}>
        <TopBar
          onSearch={handleSearch}
          onPick={handleHeaderPick}
          data={ALL_DATA}
          selectedIds={selectedIds}
          availableIds={filteredIdSet}
          onTour={() => setTourOpen(true)}
          narrow={narrow}
        />
      </div>

      {narrow ? (
        <>
          {/* Phone: one panel at a time, the tab bar below switches. Both stay
              mounted, so the tiles keep their chapter and the charts their
              scroll while the other is showing. */}
          <main style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: phoneView === 'explore' ? 'block' : 'none', height: '100%', padding: 8 }}>
              {leftPanel}
            </div>
            <div ref={chartsRef} style={{
              display: phoneView === 'charts' ? 'block' : 'none', height: '100%',
              overflowY: 'auto', overscrollBehavior: 'contain', padding: 8,
            }}>
              <div
                key={trendsMode ? `trends:${selectedIds.join(',')}` : 'calm'}
                className={trendsMode ? 'reveal-lr' : undefined}
                style={{ height: 'auto' }}
              >
                {renderRightPanel()}
              </div>
            </div>
          </main>
          <PhoneTabs view={phoneView} onView={setPhoneView} chartsLabel={chartsLabel}
            onAbout={() => setDatasetOpen(true)} />
        </>
      ) : (
      <main style={{
        // The 1600px cap left a wide margin on either side of the app on any
        // larger display, while the treemap — the thing that benefits most from
        // width — was squeezed. 2100px still stops the charts stretching absurdly
        // on an ultrawide, and the left column takes a larger share of it.
        flex: 1, width: '100%', maxWidth: '2100px', alignSelf: 'center',
        display: 'grid', gridTemplateColumns: 'minmax(440px, 44%) 1fr',
        justifyItems: 'stretch', alignItems: 'stretch',
        gap: '10px', padding: '10px',
        overflow: 'hidden', transition: 'all 0.3s ease-in-out'
      }}>

        {/* Left Panel */}
        {leftPanel}

        {/* Right Panel */}
        <div data-tour="detail" style={{ overflow: 'hidden', position: 'relative', height: '100%' }}>
          <div style={{ position: 'relative', height: '100%' }}>
            {/* Trends wipe in left→right; chapter/general swap statically. */}
            <div
              key={trendsMode ? `trends:${selectedIds.join(',')}` : 'calm'}
              className={trendsMode ? 'reveal-lr' : undefined}
              style={{ height: '100%' }}
            >
              {renderRightPanel()}
            </div>
          </div>
        </div>

      </main>
      )}

      <DatasetPopup
        open={datasetOpen}
        onClose={() => setDatasetOpen(false)}
        overallYearly={fullOverallYearly}
      />

      {/* On a phone About is a tab in the bar instead. */}
      {!narrow && <AboutPill onOpen={() => setDatasetOpen(true)} />}

      <GuidedTour open={tourOpen} onClose={closeTour} />

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

export default App;
