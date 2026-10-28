/**
 * savedGroups — the reader's own named sets, kept in localStorage.
 *
 * Three things this exists to survive, all of them real on a hospital server:
 *
 *   1. THE KEY IS NAMESPACED. The app it was forked from wrote
 *      "icd-looker-groups". If the two are ever served from the same origin —
 *      and replacing the old container on the same host and port is exactly
 *      that — then the new app would read the old one's groups, whose code ids
 *      belong to a different selection. Own name, own version.
 *   2. NOTHING TRUSTS WHAT COMES BACK. Anything can be in localStorage: a
 *      half-written value, another app's object, a hand-edited string. The
 *      shape is checked field by field and bad entries are dropped, because
 *      `group.codeIds.length` on a malformed entry crashes the whole app.
 *   3. WRITING CAN THROW. Private windows and a full quota both throw on
 *      setItem, and this one is called from inside a state updater. A lost
 *      group is a small thing; a lost session is not.
 */
import { CodeGroup } from '../types';

const KEY = 'imaging-atlas.groups.v1';

/** Total: returns [] rather than throwing, whatever is in storage. */
export function loadGroups(): CodeGroup[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return [];                         // storage disabled entirely
  }
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isGroup);
}

function isGroup(g: unknown): g is CodeGroup {
  if (!g || typeof g !== 'object') return false;
  const o = g as Record<string, unknown>;
  return typeof o.id === 'string'
    && typeof o.name === 'string'
    && typeof o.color === 'string'
    && Array.isArray(o.codeIds)
    && o.codeIds.every(c => typeof c === 'string');
}

/** Total: reports whether it stuck, never throws. */
export function saveGroups(groups: CodeGroup[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(groups));
    return true;
  } catch {
    return false;
  }
}
