/**
 * useNarrow — true on phone-width screens, where the atlas stacks its panels.
 *
 * The atlas is laid out for a desktop: two panels side by side, each filling
 * the window, the page itself never scrolling. Below NARROW_PX that layout does
 * not fit, so the panels stack and the page scrolls (index.css does the page,
 * the components read this for their own layout). Desktop is untouched.
 */
import { useEffect, useState } from 'react';

export const NARROW_PX = 900;
const QUERY = `(max-width: ${NARROW_PX - 1}px)`;

export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}
