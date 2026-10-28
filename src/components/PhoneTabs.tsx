/**
 * PhoneTabs — the bottom bar that replaces the two side-by-side panels on a phone.
 *
 * The desktop shows the tiles and the charts at once. A phone has room for one,
 * so each gets the whole screen and this bar switches between them: Explore (the
 * tiles), Charts (whatever was picked), and About, which on a desktop is the
 * floating pill in the corner. Picking a diagnosis switches to Charts by itself
 * (App does that), so the bar is mostly for going back.
 */
import { LayoutGrid, LineChart, Info } from 'lucide-react';

export type PhoneView = 'explore' | 'charts';

interface Props {
  view: PhoneView;
  onView: (v: PhoneView) => void;
  /** What the Charts tab is about — a code, a chapter, a pool — or empty. */
  chartsLabel: string;
  onAbout: () => void;
}

export const PHONE_TABS_H = 66;

export function PhoneTabs({ view, onView, chartsLabel, onAbout }: Props) {
  const tab = (on: boolean): React.CSSProperties => ({
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 1, minWidth: 0, padding: '3px 4px', borderRadius: 12,
    color: on ? 'var(--color-primary)' : 'var(--color-text-muted)',
    background: on ? 'var(--color-secondary)' : 'transparent',
  });
  const name: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, lineHeight: 1.1 };
  const sub: React.CSSProperties = {
    fontSize: 10, fontWeight: 500, lineHeight: 1.1, maxWidth: '100%',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  };
  return (
    <nav aria-label="Atlas views" style={{
      flexShrink: 0, display: 'flex', gap: 6,
      height: `calc(${PHONE_TABS_H}px + env(safe-area-inset-bottom))`,
      padding: '5px 10px calc(5px + env(safe-area-inset-bottom))',
      background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)',
      boxShadow: '0 -4px 14px -8px rgba(0, 0, 0, 0.18)', position: 'relative', zIndex: 60,
    }}>
      <button type="button" style={tab(view === 'explore')} aria-pressed={view === 'explore'}
        onClick={() => onView('explore')}>
        <LayoutGrid size={18} />
        <span style={name}>Explore</span>
      </button>
      <button type="button" style={tab(view === 'charts')} aria-pressed={view === 'charts'}
        data-tour="charts-tab" onClick={() => onView('charts')}>
        <LineChart size={18} />
        <span style={name}>Charts</span>
        {chartsLabel && <span style={sub}>{chartsLabel}</span>}
      </button>
      <button type="button" style={tab(false)} data-tour="about" aria-haspopup="dialog"
        aria-label="About this atlas and how to cite it" onClick={onAbout}>
        <Info size={18} />
        <span style={name}>About</span>
      </button>
    </nav>
  );
}
