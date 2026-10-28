/**
 * Brand tokens for the Imaging Atlas.
 * Single source of truth for the logo palette, ported from the brand guideline.
 *
 * The mark is a three-segment scan dial in three colours; those same three
 * colours map onto the three imaging modes we report on:
 *     none → single → multiple   (cool → warm escalation)
 */
export const BRAND = {
  ink: '#06080c',   // near-black field
  fog: '#7d8590',   // muted text
  mist: '#cfd6dd',  // light text
  reticle: '#DCE6E6',      // crosshair on a dark field
  reticleInk: '#2B3640',    // crosshair on the app's light surfaces (--color-ink)
  // The three brand colours
  teal: '#2FA6A0',
  blue: '#5B7FC7',
  amber: '#E6B45A',
} as const;

/**
 * Imaging-mode → brand colour. Cool (blue) for the baseline "none", brand teal
 * for a single procedure code, warm amber for the escalated "multiple" state.
 */
export const MODE = {
  none: BRAND.blue,
  single: BRAND.teal,
  multi: BRAND.amber,
} as const;
