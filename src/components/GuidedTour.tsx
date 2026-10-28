/**
 * GuidedTour — five cards that each light up one part of the atlas.
 *
 * Opened from the landing page (#/atlas?tour) or the Tour button in the top
 * bar, never on its own: it needs no memory of who has seen it, so nothing is
 * stored in the browser for it. A step finds its target by a data-tour
 * attribute and is measured again on resize, so the spotlight follows the
 * layout instead of guessing at it. Esc closes, the arrow keys step.
 *
 * On a phone the charts are a tab of their own, so two steps point at the tab
 * bar instead (each step's `phone` says where and what), and the card sits at
 * the top or the bottom of the screen, whichever leaves its target visible.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNarrow } from '../utils/useNarrow';

type Side = 'right' | 'bottom' | 'inside' | 'above-end' | 'bottom-end';

interface Step {
  target: string; side: Side; title: string; body: string;
  /** What changes on a phone, where the charts are a tab and nothing hovers. */
  phone?: { target?: string; body?: string };
}

const STEPS: Step[] = [
  {
    target: 'treemap', side: 'right', title: 'Start with a chapter',
    body: 'Each tile is an ICD-10 chapter, sized by the share of its admissions with a CT or MRI code. Click a tile to see its diagnoses, then click a diagnosis to open it.',
    phone: { body: 'Each tile is an ICD-10 chapter, sized by the share of its admissions with a CT or MRI code. Tap a tile to see its diagnoses, then tap a diagnosis to open its charts. Small tiles? Switch to List.' },
  },
  {
    target: 'modality', side: 'bottom', title: 'CT or MRI, rate or volume',
    body: 'Switch the modality here. Next to it, Rate sizes the tiles by how often imaging was coded and Vol by how many cases there were.',
  },
  {
    target: 'detail', side: 'inside', title: 'Everything about one diagnosis',
    body: 'This panel shows the chapter or diagnosis you pick: its 2005–2024 trend, the none / single / multiple split, rates for men and women, and age and comorbidity.',
    phone: {
      target: 'charts-tab',
      body: 'Whatever you pick opens here: its 2005–2024 trend, the none / single / multiple split, rates for men and women, and age and comorbidity. Explore takes you back to the tiles.',
    },
  },
  {
    target: 'search', side: 'bottom-end', title: 'Find any code',
    body: 'Search by ICD-10 code or name, or press / from anywhere. List browses all 624 diagnoses.',
    phone: { body: 'Search by ICD-10 code or name. List browses all 624 diagnoses.' },
  },
  {
    target: 'about', side: 'above-end', title: 'Who made it, and where the data come from',
    body: 'About / Cite explains the source, the limits and how to cite the atlas. It was made at the Department of Diagnostic and Interventional Radiology, University Hospital Augsburg.',
  },
];

const CARD_W = 340;
const GAP = 16;
const PAD = 6;

function place(r: DOMRect, side: Side): React.CSSProperties {
  const vw = window.innerWidth, vh = window.innerHeight;
  let left: number, top: number | undefined, bottom: number | undefined;
  switch (side) {
    case 'right': left = r.right + GAP; top = r.top + 24; break;
    case 'bottom': left = r.left; top = r.bottom + GAP; break;
    case 'bottom-end': left = r.right - CARD_W; top = r.bottom + GAP; break;
    case 'inside': left = r.left + 24; top = r.top + 24; break;
    case 'above-end': left = r.right - CARD_W; bottom = vh - r.top + GAP; break;
  }
  left = Math.max(12, Math.min(left, vw - CARD_W - 12));
  if (top !== undefined) top = Math.max(12, Math.min(top, vh - 280));
  return { left, top, bottom, width: Math.min(CARD_W, vw - 24) };
}

export function GuidedTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const narrow = useNarrow();
  const step = STEPS[i];
  const target = (narrow && step.phone?.target) || step.target;
  const body = (narrow && step.phone?.body) || step.body;
  const last = i === STEPS.length - 1;

  useEffect(() => { if (open) setI(0); }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = document.querySelector(`[data-tour="${target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    // the panels settle after their entry animation; measure once more then
    const t = window.setTimeout(measure, 350);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, target]);

  useEffect(() => { if (open) nextRef.current?.focus(); }, [open, i]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setI(n => Math.min(n + 1, STEPS.length - 1));
      else if (e.key === 'ArrowLeft') setI(n => Math.max(n - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const btn: React.CSSProperties = {
    fontSize: 14, fontWeight: 600, padding: '10px 16px', borderRadius: 9, minHeight: 44,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      {/* catches clicks, so the app underneath is not changed mid-tour */}
      <div style={{ position: 'absolute', inset: 0, background: rect ? 'transparent' : 'rgba(17, 24, 32, 0.55)' }} />
      {rect && (
        <div aria-hidden="true" style={{
          position: 'fixed', left: rect.left - PAD, top: rect.top - PAD,
          width: rect.width + 2 * PAD, height: rect.height + 2 * PAD, borderRadius: 14,
          boxShadow: '0 0 0 3px #2FA6A0, 0 0 0 9999px rgba(17, 24, 32, 0.55)',
          pointerEvents: 'none', transition: 'all 0.25s ease',
        }} />
      )}
      <div
        role="dialog" aria-modal="true" aria-labelledby="tour-title"
        style={{
          position: 'fixed',
          ...(narrow
            // the top half of the screen when the target is in the bottom half
            ? rect && rect.top > window.innerHeight / 2 ? { left: 12, right: 12, top: 12 } : { left: 12, right: 12, bottom: 12 }
            : rect ? place(rect, step.side) : { left: '50%', top: '30%', width: CARD_W, transform: 'translateX(-50%)' }),
          background: 'var(--color-surface)', borderRadius: 14, padding: 18, boxSizing: 'border-box',
          boxShadow: '0 20px 44px -16px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', gap: 10,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#23716A', letterSpacing: '0.04em' }}>
          STEP {i + 1} OF {STEPS.length}
        </div>
        <div id="tour-title" style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text-main)' }}>{step.title}</div>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: '#3E4752' }}>{body}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', paddingTop: 4 }}>
          {!last && (
            <button type="button" onClick={onClose} style={{ ...btn, color: 'var(--color-text-muted)', padding: '10px 6px', marginRight: 'auto' }}>
              Skip tour
            </button>
          )}
          {i > 0 && (
            <button type="button" onClick={() => setI(i - 1)} style={{ ...btn, border: '1px solid var(--color-border-hover)', color: 'var(--color-text-main)' }}>
              Back
            </button>
          )}
          <button
            ref={nextRef} type="button"
            onClick={() => (last ? onClose() : setI(i + 1))}
            style={{ ...btn, background: '#23716A', color: '#fff', padding: '10px 18px' }}
          >
            {last ? 'Start exploring' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
