import { useMemo, useState, useRef, useEffect, ReactNode } from 'react';
import { IcdData } from '../data/dataLoader';
import { Compass, Search, X } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface Props {
  onSearch: (id: string) => void;
  onPick: (id: string) => void;
  data: IcdData[];
  selectedIds: string[];
  availableIds: Set<string>;
  breadcrumb?: ReactNode;
  /** Opens the guided tour. */
  onTour?: () => void;
  /** Phone width: the bar wraps and the search takes a full row. */
  narrow?: boolean;
}

export function TopBar({ onSearch, onPick, data, selectedIds, availableIds, breadcrumb, onTour, narrow = false }: Props) {
  const [term, setTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // "/" jumps to the search from anywhere, as on most data sites -- unless the
  // reader is already typing into a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const suggestions = useMemo(() => {
    if (term.length < 2) return [];
    const q = term.toLowerCase();
    return data.filter(d =>
      d.code.toLowerCase().includes(q) ||
      d.title.toLowerCase().includes(q) ||
      d.chapter.toLowerCase().includes(q)
    );
  }, [term, data]);

  const quickList = useMemo(() => {
    return data
      .map(d => ({ d, n: Number(d.meta?.n_obs) || 0 }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 24)
      .map(x => x.d);
  }, [data]);

  const browseList = useMemo(() => {
    return data.slice().sort((a, b) => {
      const ac = (a.code || '').toUpperCase();
      const bc = (b.code || '').toUpperCase();
      return ac < bc ? -1 : ac > bc ? 1 : 0;
    });
  }, [data]);

  // The list currently shown in the dropdown (browse / quick-pick / search results).
  const visibleList = useMemo(
    () => (browseOpen ? browseList : term.length < 2 ? quickList : suggestions),
    [browseOpen, browseList, term, quickList, suggestions]
  );

  // Reset the keyboard cursor whenever the visible list changes.
  useEffect(() => { setActiveIndex(-1); }, [visibleList]);

  const handleSelect = (d: IcdData) => {
    onSearch(d.id);
    setTerm('');
    setIsOpen(false);
  };

  const handlePick = (d: IcdData) => {
    onPick(d.id);
    setTerm('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setIsOpen(false); setActiveIndex(-1); e.currentTarget.blur(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) { setIsOpen(true); return; }
      setActiveIndex(i => Math.min(i + 1, visibleList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const item = visibleList[activeIndex];
      // Same rule as the row itself: a code outside the cohort cannot be opened.
      if (item && availableIds.has(item.id)) {
        e.preventDefault();
        (e.ctrlKey || e.metaKey) ? handlePick(item) : handleSelect(item);
      }
    }
  };

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <div style={{
      height: narrow ? 'auto' : '100%',
      background: 'color-mix(in srgb, var(--color-surface) 82%, transparent)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid var(--color-border)',
      position: 'relative'
    }}>
    {/* The bar's content sits on the page grid: the same 2100 px cap and 10 px
        gutter as <main>, so the logo lines up with the left card and the search
        ends where the right card ends.  The search used to float in the middle
        of whatever space was left, belonging to neither column. */}
    <div style={{
      height: narrow ? 'auto' : '100%', maxWidth: '2100px', margin: '0 auto',
      padding: narrow ? '8px 10px' : '0 10px', flexWrap: narrow ? 'wrap' : 'nowrap',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: narrow ? 10 : 16,
    }}>

      {/* Logo — the scan-dial mark on a pale-teal tile, like the app's other icon tiles.
          It leads back to the landing page, which says what this is and who made it. */}
      <a href="#/" aria-label="Germany Imaging Atlas — home" style={{ display: 'flex', alignItems: 'center', gap: '11px', flexShrink: 0, textDecoration: 'none' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'var(--color-secondary)',
          boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 14%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BrandLogo size={27} title="Germany Imaging Atlas — inpatient CT and MRI" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ fontSize: '16.5px', fontWeight: 800, color: 'var(--color-text-main)', letterSpacing: '-0.01em' }}>Germany Imaging Atlas</span>
          <span style={{ fontSize: '10.5px', fontWeight: 500, letterSpacing: '0.01em', color: 'var(--color-text-muted)' }}>Inpatient CT &amp; MRI · 624 diagnoses · 2005–2024</span>
        </div>
      </a>

      {breadcrumb && (
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>{breadcrumb}</div>
      )}

      {/* Search — right-aligned with the right card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto',
        ...(narrow ? { width: '100%', marginLeft: 0 } : {}) }}>
        {onTour && (
          <button
            type="button" onClick={onTour}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10,
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              color: 'var(--color-text-main)', fontSize: 13, fontWeight: 600, boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Compass size={15} /> Tour
          </button>
        )}
        <div ref={wrapperRef} data-tour="search" style={{ position: 'relative', width: narrow ? 'auto' : 'clamp(240px, 30vw, 400px)', flex: narrow ? 1 : undefined, minWidth: 0 }}>
          <div style={{
            position: 'relative',
            display: 'flex', alignItems: 'center',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '8px 14px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <Search size={16} className="text-muted" style={{ marginRight: '8px' }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search ICD code or chapter..."
              value={term}
              role="combobox"
              aria-expanded={isOpen}
              aria-controls="icd-search-listbox"
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? `icd-opt-${activeIndex}` : undefined}
              onChange={(e) => { setTerm(e.target.value); setBrowseOpen(false); setIsOpen(true); }}
              onFocus={() => { setBrowseOpen(false); setIsOpen(true); setFocused(true); }}
              onBlur={() => setFocused(false)}
              onKeyDown={handleKeyDown}
              style={{
                border: 'none', outline: 'none', width: '100%',
                // 16px on a phone: below that iOS zooms the page into the field.
                fontSize: narrow ? '16px' : '14px', background: 'transparent'
              }}
            />
            {!term && !focused && !narrow && (
              <kbd aria-hidden="true" title="Press / to search" style={{
                fontFamily: 'inherit', fontSize: '11px', fontWeight: 600, lineHeight: 1,
                padding: '3px 6px', marginRight: '8px', borderRadius: '5px',
                border: '1px solid var(--color-border)', color: 'var(--color-text-muted)',
                background: 'var(--color-bg)',
              }}>/</kbd>
            )}
            <button
              type="button"
              aria-pressed={browseOpen}
              onClick={() => {
                const next = !browseOpen;
                setBrowseOpen(next);
                setIsOpen(true);
                if (next) setTerm('');
              }}
              style={{
                fontSize: '12px', padding: '4px 10px', borderRadius: '999px',
                background: browseOpen ? 'var(--color-bg)' : 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-main)', marginRight: '8px'
              }}
              title="Browse all ICDs"
            >
              List
            </button>
            {term && (
              <button type="button" aria-label="Clear search" onClick={() => setTerm('')}>
                <X size={14} className="text-muted" />
              </button>
            )}
          </div>

          {/* Dropdown */}
          {isOpen && (
            <div ref={listRef} id="icd-search-listbox" role="listbox" className="card" style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              marginTop: '8px', maxHeight: '400px', overflowY: 'auto',
              padding: '8px 0', zIndex: 100
            }}>
              {browseOpen ? (
                <div style={{ padding: '6px 16px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Browse all ICDs
                </div>
              ) : term.length < 2 ? (
                <div style={{ padding: '6px 16px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {narrow ? 'Quick pick' : 'Quick pick · Ctrl+click to multi-select'}
                </div>
              ) : null}

              {visibleList.length === 0 && term.length >= 2 && (
                <div style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  No matches for “{term}”
                </div>
              )}

              {visibleList.map((s, idx) => {
                const isSelected = selectedIds.includes(s.id);
                const isAvailable = availableIds.has(s.id);
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={s.id}
                    id={`icd-opt-${idx}`}
                    data-idx={idx}
                    role="option"
                    aria-selected={isSelected}
                    type="button"
                    /* A code the filters exclude has no tile, no aggregate and
                       nothing to pool, so picking it used to open an empty
                       panel. Dimming alone did not say why; this does. */
                    disabled={!isAvailable}
                    title={isAvailable ? undefined : 'Outside the current cohort — loosen the filters on the left to include it'}
                    onClick={(e) => (e.ctrlKey || e.metaKey) ? handlePick(s) : handleSelect(s)}
                    onMouseMove={() => setActiveIndex(idx)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '8px 16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      fontSize: '14px',
                      background: isActive && isAvailable ? 'var(--color-bg)' : isSelected ? 'var(--color-secondary)' : 'transparent',
                      gap: '10px', opacity: isAvailable ? 1 : 0.45,
                      cursor: isAvailable ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span className="font-medium" style={{ color: 'var(--color-primary)', flexShrink: 0 }}>{s.code}</span>
                      <span className="text-muted" style={{ fontSize: '12px', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.title}
                      </span>
                    </div>
                    {!isAvailable ? (
                      <span style={{ fontSize: '9.5px', color: 'var(--color-text-muted)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        outside cohort
                      </span>
                    ) : isSelected ? (
                      <span style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 600 }}>✓</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
    </div>
  );
}
