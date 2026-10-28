import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PAL } from '../data/chapterMeta';

interface Props {
  text: string;
}

export function InfoTip({ text }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  const TIP_WIDTH = 220;

  const handleEnter = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    // Clamp the (centered) tooltip so it never overflows the viewport sides.
    const half = TIP_WIDTH / 2;
    const x = Math.max(half + 4, Math.min(window.innerWidth - half - 4, rect.left + rect.width / 2));
    setPos({ x, y: rect.top });
  }, []);

  const handleLeave = useCallback(() => setPos(null), []);

  return (
    <span
      ref={ref}
      tabIndex={0}
      role="button"
      aria-label={text}
      style={{ display: 'inline-block', marginLeft: 4, cursor: 'help', borderRadius: '50%' }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      onKeyDown={(e) => { if (e.key === 'Escape') handleLeave(); }}
    >
      <span aria-hidden="true" style={{
        fontSize: 10, color: PAL.muted, border: `1px solid ${PAL.border}`,
        borderRadius: '50%', width: 14, height: 14, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', fontWeight: 600,
      }}>?</span>
      {pos && createPortal(
        <div role="tooltip" style={{
          position: 'fixed', left: pos.x, top: pos.y,
          transform: 'translate(-50%, -100%)',
          marginTop: -4, background: '#1a1d21', color: 'white', padding: '6px 10px',
          borderRadius: 6, fontSize: 10, lineHeight: 1.4, width: TIP_WIDTH, zIndex: 10000,
          pointerEvents: 'none', textAlign: 'left', whiteSpace: 'normal',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {text}
        </div>,
        document.body
      )}
    </span>
  );
}
