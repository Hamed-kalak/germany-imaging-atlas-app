/**
 * Landing — the page the permanent address (w3id.org/germany-imaging-atlas)
 * opens on. A reader arriving from the Article needs "what is this, who made
 * it, how do I cite it" before they need a treemap, and this page answers that
 * without fetching the 18 MB data file: the atlas only loads at #/atlas.
 *
 * Every figure on it is one the About panel (DatasetOverview) already states.
 * The hero tiles show chapter names only, in the chapters' own colours: a
 * hard-coded rate here would be a number nothing checks.
 */
import { ArrowRight, Compass } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { CHAPTER_COLORS, SHORT_LABELS } from '../data/chapterMeta';

const ACCENT = '#23716A';
const TEXT = 'var(--color-text-main)';
const BODY = '#3E4752';
const MUTED = 'var(--color-text-muted)';
const WRAP: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: '0 24px' };
const CARD: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14,
};
const H2: React.CSSProperties = { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: TEXT };

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none',
  background: ACCENT, color: '#fff', padding: '14px 22px', borderRadius: 10,
  fontSize: 16, fontWeight: 600, minHeight: 44, boxSizing: 'border-box',
};
const secondaryBtn: React.CSSProperties = {
  ...primaryBtn, background: 'var(--color-surface)', color: TEXT, border: '1px solid var(--color-border-hover)',
};

/** Hero preview: [chapter, grid column span, grid row span]. */
const TILES: [string, number, number][] = [
  ['VI', 2, 3], ['VIII', 2, 2], ['XIX', 2, 2], ['II', 2, 2], ['IX', 2, 2],
  ['XVIII', 2, 1], ['XI', 2, 1], ['III', 2, 1],
];

const STATS: [string, string][] = [
  ['624', 'ICD-10-GM diagnoses in 20 chapters'],
  ['20 years', '2005 to 2024, every year'],
  ['297 M', 'inpatient cases in the CT analysis set'],
  ['≈ 85%', 'of all German DRG hospital cases'],
];

const STEPS: [string, string][] = [
  ['Pick a chapter', 'Each tile is an ICD-10 chapter, sized by its CT or MRI rate or by case volume. Switch CT and MRI at the top.'],
  ['Open a diagnosis', 'See its twenty-year trend, the none / single / multiple split, rates for men and women, and the age and comorbidity of each group.'],
  ['Build your own group', 'Use Pool to combine diagnoses across chapters, or search any code or name from the top bar.'],
];

const AUTHORS = 'Hamed Mirbagheri, Christian Scheurig-Münkler, Simon Hellbrück, Thomas Kröncke, Josua A. Decker';
const CITATION = 'Mirbagheri H, Scheurig-Münkler C, Hellbrück S, Kröncke T, Decker JA. Germany Imaging Atlas: '
  + 'inpatient CT and MRI, version 1.0 (extraction v2.8) [dashboard]. 2026. https://w3id.org/germany-imaging-atlas/';
/** The Zenodo deposit: the tables, the analysis code and this dashboard. */
const DATA_DOI = 'https://doi.org/10.5281/zenodo.23563278';

/** In-page links scroll; a plain #id would be read as a route. */
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function Landing() {
  return (
    <div style={{ color: TEXT, background: 'var(--color-bg)', minHeight: '100vh' }}>
      <header style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ ...WRAP, paddingTop: 12, paddingBottom: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          <a href="#/" style={{ display: 'flex', alignItems: 'center', gap: 11, flexGrow: 1, textDecoration: 'none', color: TEXT }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BrandLogo size={27} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.01em' }}>Germany Imaging Atlas</span>
              <span style={{ fontSize: 11, color: MUTED }}>Inpatient CT &amp; MRI · 624 diagnoses · 2005–2024</span>
            </span>
          </a>
          <nav aria-label="Page sections" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20, fontSize: 14, fontWeight: 500 }}>
            {([['how', 'How to use it'], ['who', 'Who made it'], ['data', 'Data'], ['cite', 'Cite']] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => scrollTo(id)} style={{ color: ACCENT, fontSize: 14, fontWeight: 500, padding: '10px 0' }}>{label}</button>
            ))}
            <a href="#/atlas" style={{ ...primaryBtn, padding: '10px 18px', fontSize: 14 }}>Open the atlas</a>
          </nav>
        </div>
      </header>

      <section style={{ ...WRAP, paddingTop: 64, paddingBottom: 52, display: 'flex', flexWrap: 'wrap', gap: 52, alignItems: 'center' }}>
        <div style={{ flex: '1 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: ACCENT }}>Interactive research atlas</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(32px, 4.2vw, 48px)', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.025em' }}>
            Inpatient CT and MRI across 624 diagnoses in Germany, 2005–2024
          </h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: BODY, maxWidth: 560 }}>
            Twenty years of the German DRG statistics, the annual census of every inpatient hospital
            case. Explore, for each ICD-10 chapter and diagnosis, how often CT and MRI were coded, how
            that changed, and who was imaged.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, paddingTop: 4 }}>
            <a href="#/atlas" style={primaryBtn}>Open the atlas <ArrowRight size={17} /></a>
            <a href="#/atlas?tour" style={secondaryBtn}><Compass size={17} /> Take the guided tour</a>
          </div>
          <div style={{ fontSize: 13, color: MUTED }}>Free to use · no login · runs entirely in your browser</div>
        </div>

        <div style={{ flex: '1 1 440px', minWidth: 0 }} aria-hidden="true">
          <div style={{ ...CARD, borderRadius: 16, padding: 14, boxShadow: '0 18px 40px -24px rgba(26, 29, 33, 0.35)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gridAutoRows: 60, gap: 4 }}>
              {TILES.map(([ch, c, r]) => (
                <div key={ch} style={{
                  gridColumn: `span ${c}`, gridRow: `span ${r}`, background: CHAPTER_COLORS[ch], color: '#fff',
                  borderRadius: 6, padding: 9, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{(SHORT_LABELS[ch] ?? ch).replace(/­/g, '')}</span>
                  <span style={{ fontSize: 11, opacity: 0.85 }}>Chapter {ch}</span>
                </div>
              ))}
              <div style={{ gridColumn: 'span 2', background: '#374151', color: '#fff', borderRadius: 6, padding: 9, display: 'flex', alignItems: 'flex-end', fontSize: 13, fontWeight: 700 }}>
                + 12 more chapters
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="The atlas in numbers" style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ ...WRAP, paddingTop: 26, paddingBottom: 26, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
          {STATS.map(([v, l]) => (
            <div key={l}>
              <div className="num" style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>{v}</div>
              <div style={{ fontSize: 14, color: MUTED }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="how" style={{ ...WRAP, paddingTop: 64, scrollMarginTop: 16 }}>
        <h2 style={H2}>How to use it</h2>
        <p style={{ margin: '8px 0 26px', fontSize: 16, color: MUTED }}>Three steps, no setup.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          {STEPS.map(([title, text], i) => (
            <div key={title} style={{ ...CARD, padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--color-secondary)', color: ACCENT, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <span style={{ fontSize: 18, fontWeight: 700 }}>{title}</span>
              <span style={{ fontSize: 15, lineHeight: 1.55, color: BODY }}>{text}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...WRAP, paddingTop: 52, display: 'flex', flexWrap: 'wrap', gap: 18 }}>
        <div id="who" style={{ ...CARD, flex: '1 1 480px', minWidth: 0, padding: 28, display: 'flex', flexDirection: 'column', gap: 14, scrollMarginTop: 16 }}>
          <h2 style={{ ...H2, fontSize: 22 }}>Who made it</h2>
          <div style={{ fontSize: 16, lineHeight: 1.55 }}>
            Department of Diagnostic and Interventional Radiology<br />University Hospital Augsburg, Germany
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.6, color: BODY }}>{AUTHORS}</div>
          <div style={{ fontSize: 15, color: BODY }}>
            Contact: <a href="mailto:mohammadhamed.mirbagheri@uk-augsburg.de" style={{ color: ACCENT }}>mohammadhamed.mirbagheri@uk-augsburg.de</a>
          </div>
        </div>
        <div id="cite" style={{ ...CARD, flex: '1 1 480px', minWidth: 0, padding: 28, display: 'flex', flexDirection: 'column', gap: 12, scrollMarginTop: 16 }}>
          <h2 style={{ ...H2, fontSize: 22 }}>The article</h2>
          <div style={{ fontSize: 16, lineHeight: 1.5, fontWeight: 600 }}>
            Inpatient CT and MRI utilisation across 624 diagnoses in Germany, 2005–24: a national atlas
          </div>
          <div style={{ fontSize: 14, color: MUTED }}>In submission. The reference will appear here once it is published.</div>
          <div style={{ fontSize: 14, fontWeight: 700, paddingTop: 6 }}>Cite the atlas</div>
          <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9, padding: '12px 14px', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12.5, lineHeight: 1.6 }}>
            {CITATION}
          </div>
          <div style={{ fontSize: 14, color: BODY }}>
            Data and code: <a href={DATA_DOI} style={{ color: ACCENT }}>{DATA_DOI}</a> (Zenodo)
          </div>
        </div>
      </section>

      <section id="data" style={{ ...WRAP, paddingTop: 52, paddingBottom: 64, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32, scrollMarginTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ ...H2, fontSize: 21 }}>Where the data come from</h2>
          <div style={{ fontSize: 15, lineHeight: 1.6, color: BODY }}>
            Aggregated, disclosure-controlled tables from the German DRG statistics, computed by the
            Research Data Centre of the Federal Statistical Office and the statistical offices of the
            Länder (project 4509-2021). No author had access to individual-level records.
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: MUTED }}>
            Source: RDC of the Federal Statistical Office and Statistical Offices of the Federal
            States, DOI: 10.21242/23141.2005.00.00.1.1.0 to 10.21242/23141.2024.00.00.1.1.0, own calculations.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ ...H2, fontSize: 21 }}>What it cannot tell you</h2>
          <div style={{ fontSize: 15, lineHeight: 1.6, color: BODY }}>
            Administrative data carry no indication and no outcome, so nothing here says whether any
            imaging was warranted. OPS codes are region-specific, so a second code is a second body
            region, not necessarily a second examination. A year × code × sex cell is shown only where
            at least 100 cases in it received the modality; suppressed cells are absent, never zero.
          </div>
        </div>
      </section>

      <section style={{ background: '#1A1D21', color: '#fff' }}>
        <div style={{ ...WRAP, paddingTop: 48, paddingBottom: 48, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24 }}>
          <div style={{ flex: '1 1 420px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Ready to explore twenty years of inpatient imaging?
          </div>
          <a href="#/atlas" style={{ ...primaryBtn, background: '#fff', color: '#1A1D21' }}>Open the atlas <ArrowRight size={17} /></a>
        </div>
      </section>

      <footer style={{ ...WRAP, paddingTop: 22, paddingBottom: 30, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', fontSize: 13, color: MUTED }}>
        <div>© 2026 the authors · Version 1.0 (extraction v2.8)</div>
        <div style={{ display: 'flex', gap: 18 }}>
          <a href="#/impressum" style={{ color: ACCENT }}>Impressum</a>
          <a href="#/datenschutz" style={{ color: ACCENT }}>Datenschutz</a>
        </div>
      </footer>
    </div>
  );
}
