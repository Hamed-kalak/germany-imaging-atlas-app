/**
 * BrandLogo — the three-segment scan-dial mark.
 * A clinical reticle inside a 3-arc gauge; the three arcs carry the brand
 * colours (teal / blue / amber) that also denote none / single / multiple.
 * Geometry from the brand guideline.  It sat on a near-black tile until
 * 2026-10-05, the one dark object in an otherwise light interface; it now sits
 * on the same pale-teal tile as the app's other icon tiles, so the crosshair
 * is drawn in ink.  `tone="dark"` keeps the original light crosshair.
 */
import { BRAND } from '../data/brand';

interface Props {
  size?: number;
  /** Slowly rotate the dial (used in the landing hero). */
  spin?: boolean;
  className?: string;
  title?: string;
  /** Background the mark sits on: the light app surfaces (default) or a dark field. */
  tone?: 'light' | 'dark';
}

export function BrandLogo({ size = 32, spin = false, className, title = 'Germany Imaging Atlas', tone = 'light' }: Props) {
  const reticle = tone === 'dark' ? BRAND.reticle : BRAND.reticleInk;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label={title}
      style={spin ? { animation: 'dialSpin 22s linear infinite', transformOrigin: '50% 50%' } : undefined}
    >
      <title>{title}</title>
      <path d="M 34.39 66.41 A 27 27 0 0 1 14.32 31.66" fill="none" stroke={BRAND.teal} strokeWidth="9" strokeLinecap="round" />
      <path d="M 19.94 21.93 A 27 27 0 0 1 60.06 21.93" fill="none" stroke={BRAND.blue} strokeWidth="9" strokeLinecap="round" />
      <path d="M 65.68 31.66 A 27 27 0 0 1 45.61 66.41" fill="none" stroke={BRAND.amber} strokeWidth="9" strokeLinecap="round" />
      <g stroke={reticle} strokeWidth="3" strokeLinecap="round">
        <line x1="40" y1="31" x2="40" y2="49" />
        <line x1="31" y1="40" x2="49" y2="40" />
      </g>
      <circle cx="40" cy="40" r="2.4" fill={reticle} />
    </svg>
  );
}
