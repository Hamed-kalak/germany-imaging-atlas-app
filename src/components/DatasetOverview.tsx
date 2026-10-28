/**
 * DatasetOverview — the one About panel. Both ways in (the dataset button at the
 * top of the left column, and the About / Cite pill) open this, so the app gives
 * a single answer to "what is this, where is it from, how do I quote it".
 *
 * Canonical full-study figures (research/code/analysis/CLAIMS_REFERENCE.md), so it
 * stays accurate and glanceable regardless of the left-panel filters. The only
 * data-driven element is the overall utilisation trend (full dataset, all years).
 *
 * It used to end in four headline-finding cards. They restated the Article's
 * results in a place nobody cites, and one of them ("Growth came from intensity,
 * not reach") was the very sentence the 2026-09-15 audit struck from the
 * manuscript for overclaiming. Provenance replaced them.
 */
import { UtilizationTrendChart } from './UtilizationTrendChart';
import { YearlyRate } from '../types';
import { PAL } from '../data/chapterMeta';
import { useNarrow } from '../utils/useNarrow';

interface Props {
  overallYearly: YearlyRate[];
}

const KPIS: { v: string; l: string }[] = [
  { v: '2005–2024', l: '20 years, annual census' },
  { v: '624', l: 'ICD-10-GM codes · 20 chapters' },
  { v: '297M / 283M', l: 'cases in the CT / MRI analysis sets' },
  { v: '49.6%', l: 'male (both modalities)' },
];

const H: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 700, color: PAL.text, marginBottom: 3,
};
const COL: React.CSSProperties = {
  fontSize: 11.5, lineHeight: 1.55, color: PAL.muted,
  display: 'flex', flexDirection: 'column', gap: 11,
};

export function DatasetOverview({ overallYearly }: Props) {
  // A phone takes the four figures two by two and the two text columns one under the other.
  const narrow = useNarrow();
  return (
    <div className="card reveal-seq" style={{ height: '100%', overflow: 'auto', padding: 0 }}>
      {/* Header */}
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: PAL.text, letterSpacing: '-0.01em' }}>About this dataset</div>
        <div style={{ fontSize: 12.5, color: PAL.muted, marginTop: 3 }}>
          Twenty years of inpatient CT and MRI use across 624 ICD-10-GM diagnoses, which together
          cover about 85% of all German DRG hospital cases. Every number here is one the Article
          reports, computed in your browser from the aggregated tables the Research Data Centre
          returned.
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, 1fr)', gap: 1, background: 'var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
        {KPIS.map(k => (
          <div key={k.l} style={{ background: 'var(--color-surface)', padding: '14px 16px', textAlign: 'center' }}>
            <div className="num" style={{ fontSize: 20, fontWeight: 800, color: PAL.text }}>{k.v}</div>
            <div style={{ fontSize: 10.5, color: PAL.muted, marginTop: 3 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Overall trend (data-driven, full dataset) */}
      <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: PAL.text, marginBottom: 6 }}>Overall utilisation trend (2005–2024)</div>
        <UtilizationTrendChart data={overallYearly} height={210} />
      </div>

      {/* About and how to cite */}
      <div style={{ padding: '15px 22px 22px', display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : '1fr 1fr', gap: 20 }}>
        <div style={COL}>
          <div>
            <div style={H}>What this is</div>
            A nationwide explorer for inpatient CT and MRI utilisation, coded imaging intensity
            and temporal trends across 624 <b>ICD-10-GM</b> diagnoses, 2005–2024. Every
            number here is one the accompanying Article reports, computed in your browser
            from the same aggregated tables; an automated check asserts that all 624 codes
            match the Article's appendix table S1 exactly.
          </div>
          <div>
            <div style={H}>Sex</div>
            Sex is the binary administrative variable of the reimbursement record; cases
            recorded with another sex category were not extracted. All released sex-specific
            rates are reported, per the SAGER guidelines. Nothing here is derived from the
            difference between them: that is a separate study, and these data — one mean per
            year × code × sex cell — cannot support it.
          </div>
          <div>
            <div style={H}>What it cannot tell you</div>
            Administrative data carry no indication and no outcome, so nothing here says
            whether any imaging was warranted. OPS codes are region-specific, so a second
            code is a second body region, not necessarily a second examination. The rates
            describe these 624 diagnoses, not national inpatient rates.
          </div>
        </div>

        <div style={COL}>
          <div>
            <div style={H}>Data</div>
            Aggregated, disclosure-controlled tables from the German DRG statistics, returned
            by the Research Data Centre of the Federal Statistical Office and the statistical
            offices of the Länder under project 4509-2021. No author had access to
            individual-level records. A year × code × sex cell is present only where at least
            100 cases in it received the modality, so a diagnosis may show fewer than twenty
            years. Suppressed cells are absent, never counted as zero.
          </div>
          <div>
            <div style={H}>Mandatory source line</div>
            Source: RDC of the Federal Statistical Office and Statistical Offices of the
            Federal States, DOI: 10.21242/23141.2005.00.00.1.1.0 to 10.21242/23141.2024.00.00.1.1.0, own calculations.
          </div>
          <div style={{
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            padding: '9px 11px', borderRadius: 8, fontSize: 11, fontFamily: 'monospace',
            color: PAL.text, lineHeight: 1.5,
          }}>
            Cite as: Mirbagheri H, Scheurig-Münkler C, Hellbrück S, Kröncke T,
            Decker JA. Germany Imaging Atlas: inpatient CT and MRI, version 1.0
            (extraction v2.8) [dashboard]. 2026.
            https://w3id.org/germany-imaging-atlas/
          </div>
          <div>
            Data and code:{' '}
            <a href="https://doi.org/10.5281/zenodo.23563278" style={{ color: 'var(--color-primary)' }}>
              https://doi.org/10.5281/zenodo.23563278
            </a>{' '}(Zenodo)
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11.5 }}>
            <a href="#/" style={{ color: 'var(--color-primary)' }}>Home</a>
            <a href="#/impressum" style={{ color: 'var(--color-primary)' }}>Impressum</a>
            <a href="#/datenschutz" style={{ color: 'var(--color-primary)' }}>Datenschutz</a>
          </div>
        </div>
      </div>
    </div>
  );
}
