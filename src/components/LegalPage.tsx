/**
 * LegalPage — Impressum and Datenschutzerklärung, at #/impressum and
 * #/datenschutz, reachable from the landing footer and the About panel.
 *
 * The provider details are the Universitätsklinikum Augsburg's own Impressum
 * (www.uk-augsburg.de/impressum, read 2026-10-21), as the ScanComp supplement
 * site of the same hospital uses them. The privacy statement follows the
 * structure of the hospital's website statement (Stand 12.12.2022) and says
 * what this site actually does: hosted on GitHub Pages, no cookies, no
 * tracking, no third-party requests, local storage only for groups a reader
 * saves. Josua Decker (project lead) and Hamed Mirbagheri are named as responsible
 * for the content (2026-10-26, at JAD's request). Both pages are to be settled with
 * the hospital's IDM once it hosts the atlas; it has a standard for them.
 */
import { ArrowLeft } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

const ACCENT = '#23716A';
const BODY = '#3E4752';
const H2: React.CSSProperties = { margin: '30px 0 8px', fontSize: 19, fontWeight: 700, color: 'var(--color-text-main)' };
const P: React.CSSProperties = { margin: '0 0 10px', fontSize: 15, lineHeight: 1.65, color: BODY };

function Impressum() {
  return (
    <>
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>Impressum</h1>

      <h2 style={H2}>Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)</h2>
      <p style={P}>
        Universitätsklinikum Augsburg, Anstalt des öffentlichen Rechts, vertreten durch den Vorstand:
      </p>
      <p style={P}>
        Prof. Dr. med. Klaus Markstaller, Ärztlicher Direktor und Vorstandsvorsitzender<br />
        Michael Bungarten, Kaufmännischer Direktor<br />
        Susanne Arnold, Pflegedirektorin<br />
        Prof. Dr. Martina Kadmon, Dekanin der Medizinischen Fakultät Augsburg
      </p>
      <p style={P}>
        Vertretungsberechtigter im Sinne des § 5 DDG ist gemäß Art. 10 Absatz 3, 15a Absatz 4
        Bayerisches Universitätsklinikagesetz der Vorstandsvorsitzende und Ärztliche Direktor.
      </p>

      <h2 style={H2}>Anschrift</h2>
      <p style={P}>
        Besucheranschrift: Universitätsklinikum Augsburg, Stenglinstraße 2, 86156 Augsburg, und
        Sauerbruchstraße 6, 86179 Augsburg<br />
        Postanschrift: Universitätsklinikum Augsburg, Postfach 10 19 20, 86009 Augsburg
      </p>

      <h2 style={H2}>Kontakt</h2>
      <p style={P}>
        Telefon: 0821 400-01 (Telefonzentrale)<br />
        Fax: 0821 400-4585 (Poststelle)<br />
        E-Mail: <a href="mailto:info@uk-augsburg.de" style={{ color: ACCENT }}>info@uk-augsburg.de</a>
      </p>

      <h2 style={H2}>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG</h2>
      <p style={P}>DE 320 913 762</p>

      <h2 style={H2}>Verantwortlich für dieses Angebot</h2>
      <p style={P}>
        Der Germany Imaging Atlas ist ein Forschungsangebot der Klinik für Diagnostische und
        Interventionelle Radiologie, Universitätsklinikum Augsburg. Inhaltlich verantwortlich:
      </p>
      <p style={P}>
        PD Dr. med. Josua Decker (Projektleitung), E-Mail:{' '}
        <a href="mailto:josua.decker@uk-augsburg.de" style={{ color: ACCENT }}>josua.decker@uk-augsburg.de</a><br />
        Mohammadhamed Mirbagheri, E-Mail:{' '}
        <a href="mailto:mohammadhamed.mirbagheri@uk-augsburg.de" style={{ color: ACCENT }}>mohammadhamed.mirbagheri@uk-augsburg.de</a><br />
        Klinik für Diagnostische und Interventionelle Radiologie, Universitätsklinikum Augsburg,
        Stenglinstraße 2, 86156 Augsburg
      </p>

      <h2 style={H2}>Hinweis</h2>
      <p style={P}>
        Die Inhalte dieses Angebots dienen ausschließlich wissenschaftlichen Zwecken. Sie stellen
        keine medizinische Beratung dar und ersetzen keine ärztliche Untersuchung oder Behandlung.
        Für die Inhalte verlinkter externer Seiten sind ausschließlich deren Betreiber verantwortlich.
      </p>
    </>
  );
}

function Datenschutz() {
  return (
    <>
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>Datenschutzerklärung</h1>
      <p style={{ ...P, marginTop: 8, color: 'var(--color-text-muted)', fontSize: 13 }}>Stand: 21.10.2026</p>

      <h2 style={H2}>1. Verantwortlicher</h2>
      <p style={P}>
        Verantwortlicher im Sinne von Art. 4 Nr. 7 DSGVO ist:<br />
        Universitätsklinikum Augsburg AöR, Stenglinstr. 2, 86156 Augsburg<br />
        Telefon: +49 821 400-01, Fax: +49 821 400-4585, E-Mail:{' '}
        <a href="mailto:info@uk-augsburg.de" style={{ color: ACCENT }}>info@uk-augsburg.de</a>
      </p>
      <p style={P}>
        Die Datenschutzbeauftragte erreichen Sie unter{' '}
        <a href="mailto:Datenschutz@uk-augsburg.de" style={{ color: ACCENT }}>Datenschutz@uk-augsburg.de</a>{' '}
        oder unter der Postanschrift mit dem Zusatz „Datenschutzbeauftragte“.
      </p>

      <h2 style={H2}>2. Bereitstellung der Website und Server-Logfiles</h2>
      <p style={P}>
        Diese Website wird über GitHub Pages bereitgestellt, einen Dienst der GitHub, Inc.,
        88 Colin P. Kelly Jr. St., San Francisco, CA 94107, USA. Beim Aufruf der Website übermittelt
        Ihr Browser technisch notwendige Daten an die Server von GitHub, insbesondere IP-Adresse,
        Datum und Uhrzeit des Zugriffs, die aufgerufene Seite, Browsertyp und -version, Betriebssystem
        sowie die zuvor besuchte Seite (Referrer). Diese Daten sind erforderlich, um die Website
        auszuliefern und ihre Stabilität und Sicherheit zu gewährleisten. Nach eigenen Angaben
        protokolliert GitHub die IP-Adresse von Besucherinnen und Besuchern von GitHub-Pages-Seiten
        zu Sicherheitszwecken. Rechtsgrundlage ist Art. 6 Abs. 1 S. 1 lit. f DSGVO.
      </p>
      <p style={P}>
        Dabei können Daten in die USA übermittelt werden. GitHub ist nach eigenen Angaben unter dem
        EU-U.S. Data Privacy Framework zertifiziert; für so zertifizierte Unternehmen besteht ein
        Angemessenheitsbeschluss der EU-Kommission (Art. 45 DSGVO). Weitere Informationen enthält die{' '}
        <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer" style={{ color: ACCENT }}>
          Datenschutzerklärung von GitHub
        </a>.
      </p>

      <h2 style={H2}>3. Keine Cookies, kein Tracking, keine Drittanbieter</h2>
      <p style={P}>
        Diese Website setzt keine Cookies und verwendet keine Analyse-, Tracking- oder
        Werbedienste. Schriftarten und Daten werden mit der Website ausgeliefert; beim Aufruf werden
        keine Inhalte von Drittanbietern nachgeladen.
      </p>

      <h2 style={H2}>4. Speicherung im Browser</h2>
      <p style={P}>
        Wenn Sie im Atlas eigene Gruppen von Diagnosen speichern, werden diese ausschließlich lokal in
        Ihrem Browser (localStorage) abgelegt und nicht an uns oder Dritte übermittelt. Sie können sie
        jederzeit im Atlas oder über die Einstellungen Ihres Browsers löschen. Die Speicherung erfolgt
        nur auf Ihre ausdrückliche Aktion hin und ist für diese Funktion unbedingt erforderlich
        (§ 25 Abs. 2 Nr. 2 TDDDG).
      </p>

      <h2 style={H2}>5. Inhalte des Atlas</h2>
      <p style={P}>
        Der Atlas zeigt ausschließlich aggregierte, geheimhaltungsgeprüfte Ergebnisse des
        Forschungsdatenzentrums der Statistischen Ämter des Bundes und der Länder (Projekt 4509-2021).
        Er enthält keine Angaben zu einzelnen Patientinnen und Patienten.
      </p>

      <h2 style={H2}>6. Kontaktaufnahme per E-Mail</h2>
      <p style={P}>
        Wenn Sie uns per E-Mail kontaktieren, verarbeiten wir die von Ihnen mitgeteilten Daten
        (E-Mail-Adresse, gegebenenfalls Name und Inhalt der Nachricht), soweit dies zur Beantwortung
        Ihrer Anfrage erforderlich ist, und löschen sie, sobald sie hierfür nicht mehr benötigt werden
        und keine gesetzlichen Aufbewahrungspflichten bestehen.
      </p>

      <h2 style={H2}>7. Ihre Rechte</h2>
      <p style={P}>
        Sie haben gegenüber dem Verantwortlichen das Recht auf Auskunft, auf Berichtigung oder
        Löschung, auf Einschränkung der Verarbeitung, auf Widerspruch gegen die Verarbeitung, auf
        Widerruf einer erteilten Einwilligung und auf Datenübertragbarkeit.
      </p>
      <p style={P}>
        Sie haben zudem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
        Zuständig ist der Bayerische Landesbeauftragte für den Datenschutz, Wagmüllerstraße 18,
        80538 München.
      </p>

      <h2 style={H2}>8. Änderungen</h2>
      <p style={P}>
        Wir passen diese Datenschutzerklärung an, wenn sich die Website oder ihre Bereitstellung
        ändert. Es gilt die jeweils hier veröffentlichte Fassung.
      </p>
    </>
  );
}

export function LegalPage({ kind }: { kind: 'impressum' | 'datenschutz' }) {
  return (
    <div lang="de" style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text-main)' }}>
      <header style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '12px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          <a href="#/" style={{ display: 'flex', alignItems: 'center', gap: 11, flexGrow: 1, textDecoration: 'none', color: 'inherit' }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BrandLogo size={27} />
            </span>
            <span style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.01em' }}>Germany Imaging Atlas</span>
          </a>
          <a href="#/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: ACCENT, fontSize: 14, fontWeight: 600, textDecoration: 'none', minHeight: 44 }}>
            <ArrowLeft size={16} /> Zurück
          </a>
        </div>
      </header>
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '40px 24px 64px' }}>
        {kind === 'impressum' ? <Impressum /> : <Datenschutz />}
        <div style={{ marginTop: 40, paddingTop: 18, borderTop: '1px solid var(--color-border)', display: 'flex', gap: 18, fontSize: 13 }}>
          <a href="#/impressum" style={{ color: ACCENT }}>Impressum</a>
          <a href="#/datenschutz" style={{ color: ACCENT }}>Datenschutz</a>
          <a href="#/atlas" style={{ color: ACCENT }}>Zum Atlas</a>
        </div>
      </main>
    </div>
  );
}
