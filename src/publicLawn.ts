import type { Cell, Lawn, Level } from "./types.js";

// GitHub gives a browser no token-less route to the calendar: GraphQL wants auth and
// the profile HTML has no CORS header. This public mirror scrapes that same profile
// page and serves it with `Access-Control-Allow-Origin: *`, so the playground can show
// the real graph instead of a seeded one. Same rolling year, same 0–4 levels, same
// private contributions if the profile toggle is on — exactly what the action renders.
const MIRROR = "https://github-contributions-api.jogruber.de/v4/";

interface MirrorDay {
  date: string;
  count: number;
  level: number;
}

const DAY_MS = 86_400_000;

function epochDay(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new Error(`contributions mirror returned a bad date: ${date}`);
  return Math.floor(ms / DAY_MS);
}

function clampLevel(level: number): Level {
  return Math.min(4, Math.max(0, Math.floor(Number(level) || 0))) as Level;
}

/** Lay a run of dated days out on the calendar grid: one column per Sunday-started week. */
export function lawnFromDays(login: string, days: MirrorDay[]): Lawn {
  if (days.length === 0) throw new Error("contributions mirror returned no days");
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const first = epochDay(sorted[0].date);
  const firstWeekday = new Date(first * DAY_MS).getUTCDay();
  let weeks = 0;
  const cells: Cell[] = sorted.map((d) => {
    const offset = epochDay(d.date) - first + firstWeekday;
    const week = Math.floor(offset / 7);
    weeks = Math.max(weeks, week + 1);
    return { week, day: offset % 7, level: clampLevel(d.level), count: d.count, date: d.date };
  });
  return { login, weeks, cells };
}

/** The public contribution graph for a login, no token needed. Rejects on 404 with the same message as fetchLawn. */
export async function fetchPublicLawn(login: string, signal?: AbortSignal): Promise<Lawn> {
  const res = await fetch(`${MIRROR}${encodeURIComponent(login)}?y=last`, { signal });
  if (res.status === 404) throw new Error(`github user "${login}" not found`);
  if (!res.ok) throw new Error(`contributions mirror returned ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { contributions?: MirrorDay[] };
  if (!Array.isArray(json.contributions)) throw new Error("contributions mirror returned no days");
  return lawnFromDays(login, json.contributions);
}
