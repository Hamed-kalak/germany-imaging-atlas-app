/**
 * AboutPill — the fixed "About / Cite" trigger, bottom right.
 *
 * It used to carry a small popover of its own, so the app answered "what is
 * this and where is it from?" in two places that had drifted apart: this pill
 * and the dataset panel. There is now one panel (DatasetOverview, in the
 * dataset modal) and this is one of the two ways into it.
 *
 * It introduces itself and then gets out of the way.  On load it shows the
 * whole label, the sheen sweeps across it once, and it folds into its "i".
 * Pointing at the "i" (or tabbing to it) unfolds the label again; moving away
 * folds it back.  Provenance and the citation are what a reader most needs and
 * least goes looking for, so the first view says what the "i" is; after that a
 * full pill over the corner of the charts would only be in the way.  Under
 * prefers-reduced-motion there is no sheen and the label snaps instead of
 * sliding.
 */
import { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';

/** How long the full label stays up on load: the sheen (0.35 s delay + 2.2 s) and a beat. */
const INTRO_MS = 3000;

export function AboutPill({ onOpen }: { onOpen: () => void }) {
  const [open, setOpen] = useState(true);
  const hovered = useRef(false);
  const focused = useRef(false);
  const intro = useRef(true);

  useEffect(() => {
    const t = window.setTimeout(() => {
      intro.current = false;
      // still under the pointer or the keyboard: stay open until it leaves
      if (!hovered.current && !focused.current) setOpen(false);
    }, INTRO_MS);
    return () => window.clearTimeout(t);
  }, []);

  const settle = () => {
    if (!intro.current && !hovered.current && !focused.current) setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={`about-pill${open ? ' is-open' : ''}`}
        aria-haspopup="dialog"
        aria-label="About this atlas and how to cite it"
        data-tour="about"
        onClick={onOpen}
        onMouseEnter={() => { hovered.current = true; setOpen(true); }}
        onMouseLeave={() => { hovered.current = false; settle(); }}
        onFocus={() => { focused.current = true; setOpen(true); }}
        onBlur={() => { focused.current = false; settle(); }}
      >
        <span className="about-pill__icon" aria-hidden="true"><Info size={15} /></span>
        <span className="about-pill__label" aria-hidden="true">
          About<span className="about-pill__sep">/</span>Cite
        </span>
        <span className="about-pill__sheen" aria-hidden="true" />
      </button>

      <style>{`
        .about-pill {
          position: fixed; bottom: 24px; right: 24px; z-index: 100;
          display: flex; align-items: center; gap: 0;
          padding: 5px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          color: var(--color-text-main);
          box-shadow: var(--shadow-lg);
          cursor: pointer;
          /* clips the sheen and the folded label to the pill */
          overflow: hidden;
          transition: padding .32s cubic-bezier(.2,.7,.2,1), gap .32s cubic-bezier(.2,.7,.2,1),
                      transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }
        .about-pill.is-open { gap: 8px; padding: 8px 16px 8px 9px; }
        .about-pill:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-float);
          border-color: var(--color-primary);
        }
        .about-pill:active { transform: translateY(0); }
        .about-pill:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }

        .about-pill__icon {
          display: flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 50%;
          background: var(--color-secondary); color: var(--color-primary);
          flex-shrink: 0;
        }
        .about-pill__label {
          font-size: 13px; font-weight: 700; letter-spacing: 0.01em;
          white-space: nowrap; overflow: hidden;
          max-width: 0; opacity: 0;
          transition: max-width .32s cubic-bezier(.2,.7,.2,1), opacity .18s ease;
        }
        .about-pill.is-open .about-pill__label {
          max-width: 110px; opacity: 1;
          transition: max-width .32s cubic-bezier(.2,.7,.2,1), opacity .22s ease .08s;
        }
        .about-pill__sep { color: var(--color-text-muted); font-weight: 500; margin: 0 4px; }

        .about-pill__sheen {
          position: absolute; top: 0; bottom: 0; left: 0; width: 42%;
          background: linear-gradient(100deg,
            transparent, rgba(47,166,160,0.30), rgba(47,166,160,0.10), transparent);
          transform: translateX(-160%);
          pointer-events: none;
          /* once, on load, while the full label is showing */
          animation: aboutSheen 2.2s ease-in-out .35s 1 both;
        }
        @keyframes aboutSheen {
          from { transform: translateX(-160%); }
          to   { transform: translateX(320%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .about-pill, .about-pill__label, .about-pill.is-open .about-pill__label { transition: none; }
          .about-pill__sheen { animation: none; opacity: 0; }
        }
      `}</style>
    </>
  );
}
