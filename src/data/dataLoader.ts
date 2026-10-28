// `?url` emits realData.json as a separate hashed asset instead of inlining the
// ~25 MB dataset into the JS bundle. It is fetched at runtime (see loadData).
import realDataUrl from './realData.json?url';
import { CODE_DESCRIPTIONS } from './codeDescriptions';
import { chapterOf } from './chapterMeta';

export interface IcdData {
  id: string;
  code: string;
  title: string;
  chapter: string;
  metrics: {
    slope_overall: number;
    slope_male: number;
    slope_female: number;
    glm_score: number;
    mean_rate: number;
    prevalence: number;
    growth_rate: number;
    cv: number;
    parallelism: number;
    divergence: number;
  };
  trends: {
    year: number;
    // CT
    ct_count_male?: number;
    ct_count_female?: number;
    ct_rate_male?: number;
    ct_rate_female?: number;
    ct_age_male?: number;
    ct_age_female?: number;
    ct_elix_male?: number;
    ct_elix_female?: number;
    ct_vws_male?: number;
    ct_vws_female?: number;

    ct_count_no_male?: number;
    ct_count_no_female?: number;
    ct_age_no_male?: number;
    ct_age_no_female?: number;
    ct_elix_no_male?: number;
    ct_elix_no_female?: number;
    ct_vws_no_male?: number;
    ct_vws_no_female?: number;

    ct_multiple_male?: number;
    ct_multiple_female?: number;
    ct_age_mult_male?: number;
    ct_age_mult_female?: number;
    ct_elix_mult_male?: number;
    ct_elix_mult_female?: number;
    ct_vws_mult_male?: number;
    ct_vws_mult_female?: number;

    // MR
    mr_count_male?: number;
    mr_count_female?: number;
    mr_rate_male?: number;
    mr_rate_female?: number;
    mr_age_male?: number;
    mr_age_female?: number;
    mr_elix_male?: number;
    mr_elix_female?: number;
    mr_vws_male?: number;
    mr_vws_female?: number;

    mr_count_no_male?: number;
    mr_count_no_female?: number;
    mr_age_no_male?: number;
    mr_age_no_female?: number;
    mr_elix_no_male?: number;
    mr_elix_no_female?: number;
    mr_vws_no_male?: number;
    mr_vws_no_female?: number;

    mr_multiple_male?: number;
    mr_multiple_female?: number;
    mr_age_mult_male?: number;
    mr_age_mult_female?: number;
    mr_elix_mult_male?: number;
    mr_elix_mult_female?: number;
    mr_vws_mult_male?: number;
    mr_vws_mult_female?: number;

    // Aggregates
    count_male: number;
    count_female: number;
    rate_male: number;
    rate_female: number;
    elix_male: number;
    elix_female: number;
    age_male: number;
    age_female: number;
  }[];
  meta: {
    n_obs: number;
    n_total: number;
    years_covered: number;
    modality: 'CT' | 'MRI' | 'Both';
  }
}

/** Rows in the shipped file. A short file is a truncated deploy, not a dataset. */
const EXPECTED_ROWS = 624;

export async function loadData(): Promise<IcdData[]> {
  let res: Response;
  try {
    res = await fetch(realDataUrl);
  } catch {
    // Offline, blocked, or the server refused the connection. `fetch` rejects
    // with a TypeError whose message ("Failed to fetch") tells a reader
    // nothing about which file or which server.
    throw new Error(`Could not reach the data file at ${realDataUrl}. ` +
      `The page loaded, so the server is up — check that the asset was deployed.`);
  }
  if (!res.ok) throw new Error(`The data file returned HTTP ${res.status} (${realDataUrl}).`);

  // A single-page fallback that answers every unknown path with index.html
  // returns 200 and HTML here, and `res.json()` then fails with a parse error
  // pointing at character 1 of something that is not the data. Say what it is.
  const type = res.headers.get('content-type') || '';
  if (!type.includes('json')) {
    throw new Error(`The data file came back as "${type || 'no content-type'}", not JSON. ` +
      `The server is serving the app's HTML in its place — its SPA fallback is ` +
      `catching /assets/ instead of letting a missing file 404.`);
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new Error('The data file is not valid JSON — it is most likely truncated. ' +
      'Compare its size against the build stamp at /build.json.');
  }
  assertShape(raw);
  return enrich(raw);
}

/**
 * Fail loudly and specifically on a bad data file, rather than letting `enrich`
 * throw "cannot read properties of undefined" three frames deep. Everything
 * downstream — every rate, every chart — assumes this shape holds.
 */
function assertShape(raw: unknown): asserts raw is unknown[] {
  if (!Array.isArray(raw)) throw new Error('The data file is not an array of diagnoses.');
  if (raw.length === 0) throw new Error('The data file is empty.');
  if (raw.length !== EXPECTED_ROWS) {
    throw new Error(`The data file holds ${raw.length} diagnoses, not ${EXPECTED_ROWS}. ` +
      `This build is paired with a different dataset — check /build.json.`);
  }
  const d = raw[0] as Record<string, unknown>;
  for (const k of ['id', 'code', 'title', 'chapter', 'trends', 'meta']) {
    if (!(k in d)) throw new Error(`The data file is missing "${k}" — it is not this app's dataset.`);
  }
  if (!Array.isArray(d.trends) || d.trends.length === 0) {
    throw new Error('The data file carries no yearly trends.');
  }
}

/**
 * Turn the delivered tables into what the app renders: real ICD-10 chapters,
 * derived per-year aggregates, and the coverage meta the inclusion filter uses.
 *
 * Split out of loadData so `scripts/check-paper1-parity.mjs` can run the app's
 * own code path against the Article's appendix rather than reimplementing it —
 * a check over a copy of the logic proves nothing about what ships.
 */
export function enrich(realData: unknown): IcdData[] {
  return (realData as any[]).map(d => {
    const trends = d.trends.map((t: any) => {
      // Helper to safely get number
      const get = (k: string) => (t[k] || 0);

      // CT
      const ct_count_m = get('ct_count_male');
      const ct_count_f = get('ct_count_female');
      const ct_no_m = get('ct_count_no_male');
      const ct_no_f = get('ct_count_no_female');
      const ct_mult_m = get('ct_multiple_male');
      const ct_mult_f = get('ct_multiple_female');

      // MR
      const mr_count_m = get('mr_count_male');
      const mr_count_f = get('mr_count_female');
      const mr_no_m = get('mr_count_no_male');
      const mr_no_f = get('mr_count_no_female');
      const mr_mult_m = get('mr_multiple_male');
      const mr_mult_f = get('mr_multiple_female');

      // Aggregates — "imaged" = single + multiple (paper definition B: any imaging vs none).
      const count_male = ct_count_m + mr_count_m + ct_mult_m + mr_mult_m;
      const count_female = ct_count_f + mr_count_f + ct_mult_f + mr_mult_f;

      const total_male = count_male + ct_no_m + mr_no_m;
      const total_female = count_female + ct_no_f + mr_no_f;

      const rate_male = total_male > 0 ? (count_male / total_male * 100) : 0;
      const rate_female = total_female > 0 ? (count_female / total_female * 100) : 0;

      // Weighted Averages for Age/Elix
      const weightedAvg = (v1: number, w1: number, v2: number, w2: number) => {
        const w = w1 + w2;
        if (w === 0) return 0;
        return (v1 * w1 + v2 * w2) / w;
      };

      const age_male = weightedAvg(get('ct_age_male'), ct_count_m, get('mr_age_male'), mr_count_m);
      const age_female = weightedAvg(get('ct_age_female'), ct_count_f, get('mr_age_female'), mr_count_f);

      const elix_male = weightedAvg(get('ct_elix_male'), ct_count_m, get('mr_elix_male'), mr_count_m);
      const elix_female = weightedAvg(get('ct_elix_female'), ct_count_f, get('mr_elix_female'), mr_count_f);

      return {
        ...t,
        count_male,
        count_female,
        rate_male,
        rate_female,
        age_male,
        age_female,
        elix_male,
        elix_female
      };
    });

    // Calculate meta dynamically
    let totalObs = 0;
    let totalAll = 0;
    let yearsWithData = 0;
    let hasCT = false;
    let hasMR = false;

    trends.forEach((t: any) => {
      const ct = (t.ct_count_male || 0) + (t.ct_count_female || 0);
      const mr = (t.mr_count_male || 0) + (t.mr_count_female || 0);
      const imaged = ct + mr;

      // Total all groups (None+Single+Multiple) for paper-matching filter
      const ctAll = ct + (t.ct_count_no_male || 0) + (t.ct_count_no_female || 0) + (t.ct_multiple_male || 0) + (t.ct_multiple_female || 0);
      const mrAll = mr + (t.mr_count_no_male || 0) + (t.mr_count_no_female || 0) + (t.mr_multiple_male || 0) + (t.mr_multiple_female || 0);

      totalObs += imaged;
      totalAll += ctAll + mrAll;
      if (imaged > 0) yearsWithData++;
      if (ct > 0) hasCT = true;
      if (mr > 0) hasMR = true;
    });

    const modality = (hasCT && hasMR) ? 'Both' : (hasCT ? 'CT' : (hasMR ? 'MRI' : 'Both'));

    return {
      ...d,
      title: CODE_DESCRIPTIONS[d.code] || d.title,
      // The delivery stores the first letter of the code under `chapter`, which
      // is not an ICD-10 chapter. Resolve the real one here, at the single point
      // where data enters the app, so every view downstream agrees with the
      // Article. Codes that map to nothing keep whatever they came with; the
      // inclusion filter drops them.
      chapter: chapterOf(d.code) ?? d.chapter,
      trends,
      meta: {
        n_obs: totalObs,
        n_total: totalAll,
        years_covered: yearsWithData,
        modality
      }
    };
  });
}
