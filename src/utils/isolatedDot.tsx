/**
 * isolatedDot — draw a marker only where a released year stands alone.
 *
 * With gaps left unbridged (see the note on connectNulls), a year whose
 * neighbours were both suppressed produces a line segment of zero length, and
 * `dot={false}` renders it as nothing at all. The value is then invisible even
 * though the Research Data Centre did release it — the opposite of the mistake
 * bridging made, and just as misleading.
 *
 * So: no dots along a continuous run, one dot for an isolated point.
 */
import type { ReactElement } from 'react';

export function isolatedDot(
  values: (number | null | undefined)[], colour: string, opacity = 1,
) {
  return (props: any): ReactElement<SVGElement> => {
    const { cx, cy, index } = props;
    const here = values[index];
    const alone = here != null
      && (index === 0 || values[index - 1] == null)
      && (index === values.length - 1 || values[index + 1] == null);
    if (!alone || cx == null || cy == null) {
      // Recharts requires an element; an empty group renders nothing.
      return <g key={`d${index}`} />;
    }
    // The dot has to dim with its own line. `strokeOpacity` on the <Line>
    // never reached it, so while every line faded to 0.12 behind a hover the
    // isolated dots stayed at full strength and read as the emphasised series.
    return <circle key={`d${index}`} cx={cx} cy={cy} r={2.6} fill={colour}
      fillOpacity={opacity} stroke="none" />;
  };
}
