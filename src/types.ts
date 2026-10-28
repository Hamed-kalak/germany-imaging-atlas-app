

export type EmbeddingMode = 'ct' | 'mr' | 'combined';

export interface FilterState {
  minObsPerYear: number | null;
  minYears: number;
  // Inclusive [from, to] year window applied to utilization-trend views.
  // null = all years.
  yearRange: [number, number] | null;
}

// ── Drill-down navigation ──
export type DrillLevel =
  | { level: 'all' }
  | { level: 'chapter'; chapter: string }
  | { level: 'code'; codeId: string };

export type NavigationMode = 'sunburst' | 'umap';

// ── Claims ──
export type ClaimCategory =
  | 'aggregate'
  | 'chapter'
  | 'section'
  | 'code'
  | 'multi_procedure'
  | 'age_comorbidity'
  | 'modality_substitution'
  | 'sex';

export interface Claim {
  id: string;
  text: string;
  category: ClaimCategory;
  relatedChapters?: string[];
  relatedCodes?: string[];
  figureRef?: string;
  verified: boolean;
}

// ── Aggregations ──
export interface YearlyRate {
  year: number;
  ct_total: number;
  ct_imaged: number;
  /** null where the disclosure filter released no cells for that year. */
  ct_rate: number | null;
  ct_none: number;
  ct_single: number;
  ct_multi: number;
  mr_total: number;
  mr_imaged: number;
  /** null where the disclosure filter released no cells for that year. */
  mr_rate: number | null;
  mr_none: number;
  mr_single: number;
  mr_multi: number;
}

export interface ChapterAggregate {
  chapter: string;
  label: string;
  color: string;
  codes: string[];
  yearlyData: YearlyRate[];
  ct_total_all: number;
  mr_total_all: number;
  ct_rate_overall: number;
  mr_rate_overall: number;
  ct_slope: number;
  mr_slope: number;
  /** Overall summaries, for ordering the treemap. null where nothing released. */
  /** Multiple-code fraction, multiple/(single+multiple) x 100 -- the Article's Figure 2d. */
  ct_fraction: number | null;
  mr_fraction: number | null;
  /** Multiple-to-single ratio -- the Article's "coded imaging intensity". */
  ct_ratio: number | null;
  mr_ratio: number | null;
  /**
   * Mean age and comorbidity of the admissions IMAGED with each modality —
   * single plus multiple, count-weighted over both sexes.
   *
   * Pooling the not-imaged group back in makes the two modalities identical to
   * the decimal, because none + single + multiple is the same set of admissions
   * whichever tabulation you read it from. Restricted to the imaged, they are
   * genuinely different populations: CT patients run 5-12 years older than MRI
   * patients across the atlas.
   */
  ct_age: number | null;
  mr_age: number | null;
  ct_elix: number | null;
  mr_elix: number | null;
  ct_vws: number | null;
  mr_vws: number | null;
}

// ── Custom groups (UMAP) ──
export interface CodeGroup {
  id: string;
  name: string;
  codeIds: string[];
  color: string;
}

export const GROUP_PALETTE = [
  '#e6194B', '#3cb44b', '#ffe119', '#4363d8',
  '#f58231', '#911eb4', '#42d4f4', '#f032e6',
];

export interface CodeAggregate {
  id: string;
  code: string;
  title: string;
  chapter: string;
  section: string;
  ct_rate_overall: number;
  mr_rate_overall: number;
  /** null when none of the three years was released. */
  ct_rate_early: number | null;
  /** null when none of the three years was released. */
  ct_rate_late: number | null;
  /** null when none of the three years was released. */
  mr_rate_early: number | null;
  /** null when none of the three years was released. */
  mr_rate_late: number | null;
  ct_slope: number;
  mr_slope: number;
  ct_total: number;
  mr_total: number;
  yearlyRates: YearlyRate[];
  /** Overall summaries, for ordering the treemap. null where nothing released. */
  /** Multiple-code fraction, multiple/(single+multiple) x 100 -- the Article's Figure 2d. */
  ct_fraction: number | null;
  mr_fraction: number | null;
  /** Multiple-to-single ratio -- the Article's "coded imaging intensity". */
  ct_ratio: number | null;
  mr_ratio: number | null;
  /**
   * Mean age and comorbidity of the admissions IMAGED with each modality —
   * single plus multiple, count-weighted over both sexes.
   *
   * Pooling the not-imaged group back in makes the two modalities identical to
   * the decimal, because none + single + multiple is the same set of admissions
   * whichever tabulation you read it from. Restricted to the imaged, they are
   * genuinely different populations: CT patients run 5-12 years older than MRI
   * patients across the atlas.
   */
  ct_age: number | null;
  mr_age: number | null;
  ct_elix: number | null;
  mr_elix: number | null;
  ct_vws: number | null;
  mr_vws: number | null;
}
