/**
 * Precomputed aggregations for chapter, section, and code-level data.
 * Computed once at load time from ALL_DATA.
 */
import { IcdData } from './dataLoader';
import { CHAPTER_LABELS, CHAPTER_COLORS } from './chapterMeta';
import { ChapterAggregate, CodeAggregate, YearlyRate } from '../types';

function getVal(t: any, key: string): number {
  return Number(t[key]) || 0;
}

/**
 * Least-squares slope per year, over the released points only.
 *
 * Suppressed years arrive as null and are skipped, not read as zero — and the
 * x used is the year itself, not the array index, so a gap costs a year rather
 * than silently shortening the span.
 */
function linearSlope(ys: (number | null)[], years?: number[]): number {
  const pts: [number, number][] = [];
  ys.forEach((y, i) => { if (y != null) pts.push([years ? years[i] : i, y]); });
  if (pts.length < 3) return 0;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p[0], 0) / n;
  const my = pts.reduce((a, p) => a + p[1], 0) / n;
  let num = 0, den = 0;
  for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
  return den === 0 ? 0 : num / den;
}

function buildYearlyRate(yearMap: Map<number, { ct_yes: number; ct_no: number; ct_multi: number; mr_yes: number; mr_no: number; mr_multi: number }>): YearlyRate[] {
  const years = Array.from(yearMap.keys()).sort((a, b) => a - b);
  return years.map(year => {
    const d = yearMap.get(year)!;
    const ct_total = d.ct_yes + d.ct_no + d.ct_multi;
    const ct_imaged = d.ct_yes + d.ct_multi;
    const mr_total = d.mr_yes + d.mr_no + d.mr_multi;
    const mr_imaged = d.mr_yes + d.mr_multi;
    return {
      year,
      ct_total,
      ct_imaged,
      // No released cells is not a rate of zero. The Article omits suppressed
      // cells and never counts them as zero; a chart that plotted 0 here would
      // draw a plunge to the axis where in fact nothing is known.
      ct_rate: ct_total > 0 ? (ct_imaged / ct_total) * 100 : null,
      ct_none: d.ct_no,
      ct_single: d.ct_yes,
      ct_multi: d.ct_multi,
      mr_total,
      mr_imaged,
      mr_rate: mr_total > 0 ? (mr_imaged / mr_total) * 100 : null,
      mr_none: d.mr_no,
      mr_single: d.mr_yes,
      mr_multi: d.mr_multi,
    };
  });
}


/**
 * Overall summaries for one set of codes: the intensity measures and the
 * count-weighted means of age and comorbidity across every imaging group and
 * both sexes. These exist so the treemap can be ordered by any of them, and so
 * a chapter and a code answer the ordering question the same way.
 *
 * Every mean is weighted by the count of the stratum it belongs to, and a
 * suppressed cell contributes nothing rather than a zero.
 */
function overallSummaries(codes: IcdData[]) {
  const MODS = ['ct', 'mr'] as const;
  const SEXES = ['male', 'female'] as const;
  const c = { ct: { single: 0, multi: 0 }, mr: { single: 0, multi: 0 } };
  const means: Record<string, { num: number; den: number }> = {};
  for (const m of MODS) for (const stem of ['age', 'elix', 'vws']) means[`${m}_${stem}`] = { num: 0, den: 0 };
  /**
   * The imaged strata only — one procedure code, and more than one.
   *
   * The not-imaged group used to be pooled in alongside them, which made the
   * CT and the MRI figure identical to the decimal: none + single + multiple is
   * the same set of admissions in either tabulation, so the weighted mean could
   * not tell them apart, and the modality toggle above the treemap moved
   * nothing. Read over the imaged alone they are different populations, which
   * is what "the mean age of the CT scans" means.
   */
  const STRATA: [string, string][] = [['', 'count'], ['_mult', 'multiple']];

  for (const d of codes) for (const t of d.trends as any[]) {
    for (const m of MODS) {
      for (const sx of SEXES) {
        c[m].single += Number(t[`${m}_count_${sx}`]) || 0;
        c[m].multi += Number(t[`${m}_multiple_${sx}`]) || 0;
        for (const stem of ['age', 'elix', 'vws']) {
          const acc = means[`${m}_${stem}`];
          for (const [suffix, countKey] of STRATA) {
            const v = Number(t[`${m}_${stem}${suffix}_${sx}`]);
            const w = Number(t[`${m}_${countKey}_${sx}`]) || 0;
            if (Number.isFinite(v) && w > 0) { acc.num += v * w; acc.den += w; }
          }
        }
      }
    }
  }

  const mean = (k: string) => (means[k].den > 0 ? means[k].num / means[k].den : null);
  const imaged = (m: 'ct' | 'mr') => c[m].single + c[m].multi;
  return {
    ct_fraction: imaged('ct') > 0 ? (c.ct.multi / imaged('ct')) * 100 : null,
    mr_fraction: imaged('mr') > 0 ? (c.mr.multi / imaged('mr')) * 100 : null,
    ct_ratio: c.ct.single > 0 ? c.ct.multi / c.ct.single : null,
    mr_ratio: c.mr.single > 0 ? c.mr.multi / c.mr.single : null,
    ct_age: mean('ct_age'), mr_age: mean('mr_age'),
    ct_elix: mean('ct_elix'), mr_elix: mean('mr_elix'),
    ct_vws: mean('ct_vws'), mr_vws: mean('mr_vws'),
  };
}

export function computeChapterAggregates(data: IcdData[]): Map<string, ChapterAggregate> {
  const chapMap = new Map<string, {
    codes: string[];
    members: IcdData[];
    yearMap: Map<number, { ct_yes: number; ct_no: number; ct_multi: number; mr_yes: number; mr_no: number; mr_multi: number }>;
    ct_yes_all: number; ct_no_all: number; ct_multi_all: number;
    mr_yes_all: number; mr_no_all: number; mr_multi_all: number;
  }>();

  for (const d of data) {
    const ch = d.chapter;
    if (!chapMap.has(ch)) {
      chapMap.set(ch, {
        codes: [],
        members: [],
        yearMap: new Map(),
        ct_yes_all: 0, ct_no_all: 0, ct_multi_all: 0,
        mr_yes_all: 0, mr_no_all: 0, mr_multi_all: 0,
      });
    }
    const agg = chapMap.get(ch)!;
    agg.codes.push(d.id);
    agg.members.push(d);

    for (const t of d.trends) {
      const yr = t.year;
      if (!agg.yearMap.has(yr)) {
        agg.yearMap.set(yr, { ct_yes: 0, ct_no: 0, ct_multi: 0, mr_yes: 0, mr_no: 0, mr_multi: 0 });
      }
      const yd = agg.yearMap.get(yr)!;

      const ct_yes = getVal(t, 'ct_count_male') + getVal(t, 'ct_count_female');
      const ct_no = getVal(t, 'ct_count_no_male') + getVal(t, 'ct_count_no_female');
      const ct_multi = getVal(t, 'ct_multiple_male') + getVal(t, 'ct_multiple_female');
      const mr_yes = getVal(t, 'mr_count_male') + getVal(t, 'mr_count_female');
      const mr_no = getVal(t, 'mr_count_no_male') + getVal(t, 'mr_count_no_female');
      const mr_multi = getVal(t, 'mr_multiple_male') + getVal(t, 'mr_multiple_female');

      yd.ct_yes += ct_yes; yd.ct_no += ct_no; yd.ct_multi += ct_multi;
      yd.mr_yes += mr_yes; yd.mr_no += mr_no; yd.mr_multi += mr_multi;

      agg.ct_yes_all += ct_yes; agg.ct_no_all += ct_no; agg.ct_multi_all += ct_multi;
      agg.mr_yes_all += mr_yes; agg.mr_no_all += mr_no; agg.mr_multi_all += mr_multi;
    }
  }

  const result = new Map<string, ChapterAggregate>();

  for (const [ch, agg] of chapMap) {
    const yearlyData = buildYearlyRate(agg.yearMap);
    const ct_total_all = agg.ct_yes_all + agg.ct_no_all + agg.ct_multi_all;
    const mr_total_all = agg.mr_yes_all + agg.mr_no_all + agg.mr_multi_all;
    const ct_imaged_all = agg.ct_yes_all + agg.ct_multi_all;
    const mr_imaged_all = agg.mr_yes_all + agg.mr_multi_all;

    result.set(ch, {
      chapter: ch,
      label: CHAPTER_LABELS[ch] || ch,
      color: CHAPTER_COLORS[ch] || '#888',
      codes: agg.codes,
      yearlyData,
      ct_total_all,
      mr_total_all,
      ct_rate_overall: ct_total_all > 0 ? (ct_imaged_all / ct_total_all) * 100 : 0,
      mr_rate_overall: mr_total_all > 0 ? (mr_imaged_all / mr_total_all) * 100 : 0,
      ct_slope: linearSlope(yearlyData.map(y => y.ct_rate), yearlyData.map(y => y.year)),
      mr_slope: linearSlope(yearlyData.map(y => y.mr_rate), yearlyData.map(y => y.year)),
      ...overallSummaries(agg.members),
    });
  }

  return result;
}

export function computeCodeAggregates(data: IcdData[]): Map<string, CodeAggregate> {
  const result = new Map<string, CodeAggregate>();

  for (const d of data) {
    const yearMap = new Map<number, { ct_yes: number; ct_no: number; ct_multi: number; mr_yes: number; mr_no: number; mr_multi: number }>();

    let ct_yes_all = 0, ct_no_all = 0, ct_multi_all = 0;
    let mr_yes_all = 0, mr_no_all = 0, mr_multi_all = 0;

    for (const t of d.trends) {
      const ct_yes = getVal(t, 'ct_count_male') + getVal(t, 'ct_count_female');
      const ct_no = getVal(t, 'ct_count_no_male') + getVal(t, 'ct_count_no_female');
      const ct_multi = getVal(t, 'ct_multiple_male') + getVal(t, 'ct_multiple_female');
      const mr_yes = getVal(t, 'mr_count_male') + getVal(t, 'mr_count_female');
      const mr_no = getVal(t, 'mr_count_no_male') + getVal(t, 'mr_count_no_female');
      const mr_multi = getVal(t, 'mr_multiple_male') + getVal(t, 'mr_multiple_female');

      yearMap.set(t.year, { ct_yes, ct_no, ct_multi, mr_yes, mr_no, mr_multi });

      ct_yes_all += ct_yes; ct_no_all += ct_no; ct_multi_all += ct_multi;
      mr_yes_all += mr_yes; mr_no_all += mr_no; mr_multi_all += mr_multi;
    }

    const yearlyRates = buildYearlyRate(yearMap);
    const ct_total = ct_yes_all + ct_no_all + ct_multi_all;
    const mr_total = mr_yes_all + mr_no_all + mr_multi_all;

    // Early = first 3 years, late = last 3 years. Null, not zero, when none of
    // the three was released: "4.7% -> 0.0%" read as a collapse to no imaging
    // at all, where the truth is that the last three years are not known.
    const earlyYears = yearlyRates.slice(0, 3);
    const lateYears = yearlyRates.slice(-3);
    const avgRate = (arr: YearlyRate[], mod: 'ct' | 'mr'): number | null => {
      const vals = arr.map(y => (mod === 'ct' ? y.ct_rate : y.mr_rate)).filter((v): v is number => v != null);
      if (!vals.length) return null;
      return vals.reduce((s, v) => s + v, 0) / vals.length;
    };

    result.set(d.id, {
      id: d.id,
      code: d.code,
      title: d.title,
      chapter: d.chapter,
      section: d.code.slice(0, 2),
      ct_rate_overall: ct_total > 0 ? ((ct_yes_all + ct_multi_all) / ct_total) * 100 : 0,
      mr_rate_overall: mr_total > 0 ? ((mr_yes_all + mr_multi_all) / mr_total) * 100 : 0,
      ct_rate_early: avgRate(earlyYears, 'ct'),
      ct_rate_late: avgRate(lateYears, 'ct'),
      mr_rate_early: avgRate(earlyYears, 'mr'),
      mr_rate_late: avgRate(lateYears, 'mr'),
      ct_slope: linearSlope(yearlyRates.map(y => y.ct_rate), yearlyRates.map(y => y.year)),
      mr_slope: linearSlope(yearlyRates.map(y => y.mr_rate), yearlyRates.map(y => y.year)),
      ct_total,
      mr_total,
      yearlyRates,
      ...overallSummaries([d]),
    });
  }

  return result;
}

/** Compute overall (grand total) yearly rates across all codes */
export function computeOverallYearly(data: IcdData[]): YearlyRate[] {
  const yearMap = new Map<number, { ct_yes: number; ct_no: number; ct_multi: number; mr_yes: number; mr_no: number; mr_multi: number }>();

  for (const d of data) {
    for (const t of d.trends) {
      if (!yearMap.has(t.year)) {
        yearMap.set(t.year, { ct_yes: 0, ct_no: 0, ct_multi: 0, mr_yes: 0, mr_no: 0, mr_multi: 0 });
      }
      const yd = yearMap.get(t.year)!;
      yd.ct_yes += getVal(t, 'ct_count_male') + getVal(t, 'ct_count_female');
      yd.ct_no += getVal(t, 'ct_count_no_male') + getVal(t, 'ct_count_no_female');
      yd.ct_multi += getVal(t, 'ct_multiple_male') + getVal(t, 'ct_multiple_female');
      yd.mr_yes += getVal(t, 'mr_count_male') + getVal(t, 'mr_count_female');
      yd.mr_no += getVal(t, 'mr_count_no_male') + getVal(t, 'mr_count_no_female');
      yd.mr_multi += getVal(t, 'mr_multiple_male') + getVal(t, 'mr_multiple_female');
    }
  }

  return buildYearlyRate(yearMap);
}

/**
 * Collapse a chapter's codes into one synthetic record, so a chapter can be
 * rendered by exactly the same panel a single diagnosis is.
 *
 * The Article's data-sharing statement promises, "for each ICD-10 code **and
 * chapter**, the CT and MRI utilisation trend, the none/single/multiple
 * breakdown, sex-stratified rates, and patient age and comorbidity by imaging
 * group". Re-implementing all of that for chapters would be a second code path
 * to keep in step with the first; summing the inputs instead means there is
 * only ever one.
 *
 * Counts add. Age and comorbidity are stratum means, so they combine weighted
 * by that stratum's own count in that year — never unweighted, and never
 * weighted by a different group's count. Rates are recomputed from the pooled
 * counts rather than averaged, because averaging a rate across codes of wildly
 * different size is not the chapter's rate.
 *
 * Suppressed cells are absent rather than zero, so a year contributes to a mean
 * only through the codes that released it.
 */
export function chapterRecord(codes: IcdData[], chapter: string, code: string, title: string): IcdData {
  const MODS = ['ct', 'mr'] as const;
  const SEXES = ['male', 'female'] as const;
  // [mean field suffix, the count field that weights it]
  const STRATA: [string, string][] = [
    ['age_$S', 'count_$S'], ['elix_$S', 'count_$S'], ['vws_$S', 'count_$S'],
    ['age_no_$S', 'count_no_$S'], ['elix_no_$S', 'count_no_$S'], ['vws_no_$S', 'count_no_$S'],
    ['age_mult_$S', 'multiple_$S'], ['elix_mult_$S', 'multiple_$S'], ['vws_mult_$S', 'multiple_$S'],
  ];

  const years = [...new Set(codes.flatMap(c => c.trends.map(t => t.year)))].sort((a, b) => a - b);
  const byYear = new Map<number, any[]>();
  for (const c of codes) for (const t of c.trends) {
    if (!byYear.has(t.year)) byYear.set(t.year, []);
    byYear.get(t.year)!.push(t);
  }

  const trends = years.map(year => {
    const ts = byYear.get(year) ?? [];
    const out: any = { year };

    for (const m of MODS) for (const s of SEXES) {
      for (const kind of ['count', 'count_no', 'multiple']) {
        out[`${m}_${kind}_${s}`] = ts.reduce((a, t) => a + (Number(t[`${m}_${kind}_${s}`]) || 0), 0);
      }
      for (const [mean, weight] of STRATA) {
        const mk = `${m}_${mean.replace('$S', s)}`;
        const wk = `${m}_${weight.replace('$S', s)}`;
        let num = 0, den = 0;
        for (const t of ts) {
          const v = Number(t[mk]);
          const w = Number(t[wk]) || 0;
          if (Number.isFinite(v) && w > 0) { num += v * w; den += w; }
        }
        out[mk] = den > 0 ? num / den : 0;
      }
      // Recomputed from the pooled counts, not averaged across codes.
      const single = out[`${m}_count_${s}`], none = out[`${m}_count_no_${s}`], multi = out[`${m}_multiple_${s}`];
      const total = single + none + multi;
      out[`${m}_rate_${s}`] = total > 0 ? ((single + multi) / total) * 100 : 0;
    }

    const imaged = MODS.flatMap(m => [out[`${m}_count_male`], out[`${m}_multiple_male`]]).reduce((a, b) => a + b, 0);
    const imagedF = MODS.flatMap(m => [out[`${m}_count_female`], out[`${m}_multiple_female`]]).reduce((a, b) => a + b, 0);
    out.count_male = imaged;
    out.count_female = imagedF;
    return out;
  });

  return {
    id: `chapter:${chapter}`,
    code,
    title,
    chapter,
    metrics: {} as any,
    trends,
    meta: {
      n_obs: 0,
      n_total: 0,
      years_covered: years.length,
      modality: 'Both',
    },
  } as IcdData;
}
