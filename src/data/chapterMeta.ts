/**
 * ICD-10-GM chapter metadata — chapters resolved from the CODE RANGE, not the
 * first letter.
 *
 * The classification is **ICD-10-GM**, the German Modification published by
 * BfArM (https://klassifikationen.bfarm.de/icd-10-gm/). That is what the German
 * DRG statistics code in, and it is not interchangeable with either WHO ICD-10
 * or ICD-10-CM:
 *
 *   * chapter III runs **D50-D90** in GM, D50-D89 in WHO;
 *   * chapter XX ends at **Y84** in GM, Y98 in WHO;
 *   * chapter XXII (**U00-U99**) exists in GM for codes for special purposes,
 *     which is where U07.1 (COVID-19) lives;
 *   * an earlier build's ranges were ICD-10-**CM** (K00-K95, F01-F99, O00-O9A,
 *     S00-S99, T07-T88) — a different national modification again.
 *
 * None of that moves a number here, because a chapter is only ever assigned
 * from a code that the delivery contains; it decides what the chapters are
 * *called* and where their boundaries sit.
 *
 * Grouping by first letter, which an earlier build did, is a different matter and does
 * move numbers: four chapters do not line up with a single letter. A00-B99 is
 * one chapter split across two letters, S00-T98 likewise, while D and H each
 * straddle a boundary (D00-D48 neoplasms / D50-D90 blood; H00-H59 eye /
 * H60-H95 ear). Letter grouping therefore splits chapters I and XIX in two and
 * merges II+III and VII+VIII, which moves every chapter-level rate, trend and
 * rank.
 *
 * This is a port of research/code/analysis/icd_chapters.py, which is what the
 * Article's figures and tables use.
 *
 * The 624 included codes populate 20 of the 22 chapters; XX (external causes)
 * and XXII (special purposes) are not represented.
 */

/** Chapter numeral → [first code, last code]. Canonical ICD-10-GM order. */
export const CHAPTER_RANGES: Record<string, string> = {
  I: 'A00–B99', II: 'C00–D48', III: 'D50–D90', IV: 'E00–E90', V: 'F00–F99',
  VI: 'G00–G99', VII: 'H00–H59', VIII: 'H60–H95', IX: 'I00–I99', X: 'J00–J99',
  XI: 'K00–K93', XII: 'L00–L99', XIII: 'M00–M99', XIV: 'N00–N99', XV: 'O00–O99',
  XVI: 'P00–P96', XVII: 'Q00–Q99', XVIII: 'R00–R99', XIX: 'S00–T98',
  XX: 'V01–Y84', XXI: 'Z00–Z99', XXII: 'U00–U99',
};

const CHAPTER_ORDER = Object.keys(CHAPTER_RANGES);
export { CHAPTER_ORDER };

/** Full chapter titles, as ICD-10-GM words them, with the range appended. */
export const CHAPTER_LABELS: Record<string, string> = {
  I: 'Certain infectious and parasitic diseases (A00–B99)',
  II: 'Neoplasms (C00–D48)',
  III: 'Diseases of the blood and blood-forming organs, and certain disorders involving the immune mechanism (D50–D90)',
  IV: 'Endocrine, nutritional and metabolic diseases (E00–E90)',
  V: 'Mental and behavioural disorders (F00–F99)',
  VI: 'Diseases of the nervous system (G00–G99)',
  VII: 'Diseases of the eye and adnexa (H00–H59)',
  VIII: 'Diseases of the ear and mastoid process (H60–H95)',
  IX: 'Diseases of the circulatory system (I00–I99)',
  X: 'Diseases of the respiratory system (J00–J99)',
  XI: 'Diseases of the digestive system (K00–K93)',
  XII: 'Diseases of the skin and subcutaneous tissue (L00–L99)',
  XIII: 'Diseases of the musculoskeletal system and connective tissue (M00–M99)',
  XIV: 'Diseases of the genitourinary system (N00–N99)',
  XV: 'Pregnancy, childbirth and the puerperium (O00–O99)',
  XVI: 'Certain conditions originating in the perinatal period (P00–P96)',
  XVII: 'Congenital malformations, deformations and chromosomal abnormalities (Q00–Q99)',
  XVIII: 'Symptoms, signs and abnormal clinical and laboratory findings (R00–R99)',
  XIX: 'Injury, poisoning and certain other consequences of external causes (S00–T98)',
  XX: 'External causes of morbidity and mortality (V01–Y84)',
  XXI: 'Factors influencing health status and contact with health services (Z00–Z99)',
  XXII: 'Codes for special purposes (U00–U99)',
};

/**
 * Short labels — the wording the Article's figures and tables use.
 *
 * The long ones carry a soft hyphen (U+00AD). Treemap tiles are sized by data,
 * not by label, so a narrow tile has to break "Musculoskeletal" somewhere; the
 * soft hyphen says where, and renders a hyphen when it is used and nothing when
 * it is not. Without it the browser broke mid-word with no hyphen at all.
 */
export const SHORT_LABELS: Record<string, string> = {
  I: 'Infectious', II: 'Neoplasms', III: 'Blood & immune', IV: 'Endocrine',
  V: 'Mental', VI: 'Nervous', VII: 'Eye', VIII: 'Ear', IX: 'Circulatory',
  X: 'Respiratory', XI: 'Digestive', XII: 'Skin', XIII: 'Musculo\u00ADskeletal',
  XIV: 'Genito\u00ADurinary', XV: 'Pregnancy', XVI: 'Perinatal', XVII: 'Congenital',
  XVIII: 'Symptoms', XIX: 'Injury & poisoning', XX: 'External causes',
  XXI: 'Health factors', XXII: 'Special purposes',
};

/** Letters belonging to exactly one chapter. A/B/C/D/H/S/T and V-Y need the
 *  numeric test in chapterOf(). */
const UNAMBIGUOUS: Record<string, string> = {
  E: 'IV', F: 'V', G: 'VI', I: 'IX', J: 'X', K: 'XI', L: 'XII', M: 'XIII',
  N: 'XIV', O: 'XV', P: 'XVI', Q: 'XVII', R: 'XVIII', Z: 'XXI', U: 'XXII',
};

/**
 * The ICD-10 chapter numeral for a three-character code. Returns null for
 * anything that is not one (the delivery carries a sentinel row that the
 * inclusion filter drops).
 */
export function chapterOf(code: string): string | null {
  const m = /^([A-Z])(\d\d)/.exec(code.trim().toUpperCase());
  if (!m) return null;
  const letter = m[1];
  const n = parseInt(m[2], 10);
  if (letter === 'A' || letter === 'B') return 'I';
  if (letter === 'C') return 'II';
  if (letter === 'D') return n <= 48 ? 'II' : 'III';
  if (letter === 'H') return n <= 59 ? 'VII' : 'VIII';
  if (letter === 'S' || letter === 'T') return 'XIX';
  if ('VWXY'.includes(letter)) return 'XX';
  return UNAMBIGUOUS[letter] ?? null;
}

/** Canonical chapter order (I, II, … XXII) for axes, tables and tile layout. */
export function chapterSortKey(chapter: string): number {
  const i = CHAPTER_ORDER.indexOf(chapter);
  return i < 0 ? CHAPTER_ORDER.length : i;
}

/**
 * Chapter palette — the Article's figure palette, ported from
 * research/code/analysis/style.py (CHAPTER_COLORS), in the same chapter order.
 * A reader moving between a figure and this page should see a chapter keep its
 * colour; the previous three-hue ramp had no relationship to the figures at all.
 *
 * Five colours are darkened, by between 13% and 21% towards ink, and nothing
 * else is touched. Tile labels are white, and those five — the light teal,
 * orange, green, orange-red and cyan — sit between 3.19:1 and 3.68:1 against
 * white, under the 4.5:1 that text this size needs. Each is darkened by the
 * least that clears it, so the hue is unmistakably the figure's. On paper the
 * figures put these behind black text, where the same colours are fine; it is
 * only white-on-fill that forces the adjustment.
 *
 *   figure    tile      chapter
 *   #469990 → #3d817b   I    (teal)
 *   #d97706 → #af630a   II   (orange)
 *   #16a34a → #158841   V    (green)
 *   #ea580c → #ca4e0e   VII  (orange-red)
 *   #0891b2 → #09819e   VIII (cyan)
 */
const FIGURE_PALETTE = [
  '#3d817b', '#af630a', '#2563eb', '#C44D6B', '#158841', '#7c3aed',
  '#ca4e0e', '#09819e', '#be185d', '#854d0e', '#166534', '#1d4ed8',
  '#9f1239', '#047857', '#a16207', '#1e3a5f', '#6d28d9', '#b45309',
  '#065f46', '#1e40af', '#374151', '#78350f',
];

export const CHAPTER_COLORS: Record<string, string> = {};
CHAPTER_ORDER.forEach((ch, i) => {
  CHAPTER_COLORS[ch] = FIGURE_PALETTE[i % FIGURE_PALETTE.length];
});

export const PAL = {
  // Data colours — teal = CT, sienna = MR (refined per design handoff)
  ct: '#2F8E84',
  mr: '#BD7A2E',
  // Neutral "ink" brand — used for UI chrome (logo, active mode toggles, code chips)
  ink: '#2B3640',
  male: '#1D6FA8',
  female: '#C44D6B',
  // Legacy traffic-light group colours (kept for back-compat; prefer the ramps below)
  yes: '#d4b000',
  no: '#e6194B',
  multi: '#3cb44b',
  primary: '#2F8E84',
  positive: '#2F7A50',   // 5.4:1 on white; #4E9A6B was 3.4:1, below AA for 11px text
  text: '#1A1D21',
  muted: '#5F6B7A',
  border: '#E2E5EA',
  bg: '#F4F5F7',
  surface: '#FFFFFF',
  // Imaging-mode colours (None → Single → Multiple) — the three brand
  // colours from the logo scan-dial (blue → teal → amber), shared across both
  // modalities so the three modes read consistently everywhere.
  groupCt: { none: '#5B7FC7', single: '#2FA6A0', multi: '#E6B45A' },
  groupMr: { none: '#5B7FC7', single: '#2FA6A0', multi: '#E6B45A' },
};

export type GroupRamp = { none: string; single: string; multi: string };
export const groupRamp = (mod: 'ct' | 'mr'): GroupRamp => (mod === 'mr' ? PAL.groupMr : PAL.groupCt);

/** Mix `hex` towards near-black. Used by the treemap to encode a low
 *  utilisation rate as a deeper shade of the chapter's own colour — darker
 *  rather than paler, so a white label reads on every tile in the range. */
export function darken(hex: string, factor = 0.5): string {
  const ink = [0x12, 0x16, 0x1a];
  const parts = [1, 3, 5].map((i, k) => {
    const v = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(v + (ink[k] - v) * factor).toString(16).padStart(2, '0');
  });
  return `#${parts.join('')}`;
}

export function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
