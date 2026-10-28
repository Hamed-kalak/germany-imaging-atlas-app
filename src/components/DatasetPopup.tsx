/**
 * DatasetPopup — dimmed modal holding the dataset stats + overall utilisation
 * trend (the OverviewPanel content), opened from the top of the left column.
 */
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { DatasetOverview } from './DatasetOverview';
import { YearlyRate } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  overallYearly: YearlyRate[];
}

export function DatasetPopup({ open, onClose, overallYearly }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(16,32,30,0.45)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'min(24px, 3vw)',
        animation: 'dpFade 0.18s ease-out',
      }}
    >
      <div
        role="dialog" aria-modal="true" aria-label="About"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: 'min(940px, 94vw)', height: 'min(82vh, 760px)', maxHeight: '88dvh',
          background: 'var(--color-surface)', borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-float)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          animation: 'dpRise 0.2s ease-out',
        }}
      >
        <button
          type="button" aria-label="Close" onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 2,
            width: 30, height: 30, borderRadius: 8, border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', color: 'var(--color-text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>
        <div style={{ flex: 1, minHeight: 0 }}>
          <DatasetOverview overallYearly={overallYearly} />
        </div>
      </div>
      <style>{`
        @keyframes dpFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dpRise { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}
