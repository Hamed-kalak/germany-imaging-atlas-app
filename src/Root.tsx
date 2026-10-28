/**
 * Root — which page the address names.
 *
 *   #/ (or nothing)    Landing: what this is, who made it, how to cite it
 *   #/atlas            the atlas
 *   #/atlas?tour       the atlas, opening on the guided tour
 *   #/impressum        Impressum
 *   #/datenschutz      Datenschutzerklärung
 *
 * Hash routes, because GitHub Pages serves one index.html and cannot rewrite
 * paths. The atlas mounts on first visit and then stays mounted while the
 * reader looks at another page, so going back to it does not refetch the data
 * or lose the reader's place.
 */
import { useEffect, useState } from 'react';
import App from './App.tsx';
import { Landing } from './components/Landing.tsx';
import { LegalPage } from './components/LegalPage.tsx';

type Page = 'home' | 'atlas' | 'impressum' | 'datenschutz';

function parse(hash: string): { page: Page; tour: boolean } {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  if (path === 'atlas') return { page: 'atlas', tour: query.split('&').includes('tour') };
  if (path === 'impressum' || path === 'datenschutz') return { page: path, tour: false };
  return { page: 'home', tour: false };
}

export function Root() {
  const [page, setPage] = useState<Page>(() => parse(window.location.hash).page);
  const [atlasSeen, setAtlasSeen] = useState(page === 'atlas');
  // Bumped once per request for the tour; the atlas opens it when its data is in.
  const [tourSignal, setTourSignal] = useState(() => (parse(window.location.hash).tour ? 1 : 0));

  useEffect(() => {
    const sync = () => {
      const r = parse(window.location.hash);
      setPage(r.page);
      if (r.page === 'atlas') setAtlasSeen(true);
      if (r.tour) setTourSignal(n => n + 1);
      if (r.page !== 'atlas') window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  // A ?tour address is a request, not a place: once read, drop it, so a reload
  // or a shared link does not replay the tour.
  useEffect(() => {
    if (parse(window.location.hash).tour) history.replaceState(null, '', '#/atlas');
  }, [tourSignal]);

  // The atlas is an app-like, non-scrolling page; the others are documents.
  useEffect(() => { document.body.dataset.page = page === 'atlas' ? 'app' : 'doc'; }, [page]);

  return (
    <>
      {atlasSeen && (
        <div style={{ display: page === 'atlas' ? 'contents' : 'none' }}>
          <App tourSignal={tourSignal} />
        </div>
      )}
      {page === 'home' && <Landing />}
      {(page === 'impressum' || page === 'datenschutz') && <LegalPage kind={page} />}
    </>
  );
}
