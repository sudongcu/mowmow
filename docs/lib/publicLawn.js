const MIRROR = "https://github-contributions-api.jogruber.de/v4/";
const DAY_MS = 86_400_000;
function epochDay(date) {
    const ms = Date.parse(`${date}T00:00:00Z`);
    if (Number.isNaN(ms))
        throw new Error(`contributions mirror returned a bad date: ${date}`);
    return Math.floor(ms / DAY_MS);
}
function clampLevel(level) {
    return Math.min(4, Math.max(0, Math.floor(Number(level) || 0)));
}
export function lawnFromDays(login, days) {
    if (days.length === 0)
        throw new Error("contributions mirror returned no days");
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
    const first = epochDay(sorted[0].date);
    const firstWeekday = new Date(first * DAY_MS).getUTCDay();
    let weeks = 0;
    const cells = sorted.map((d) => {
        const offset = epochDay(d.date) - first + firstWeekday;
        const week = Math.floor(offset / 7);
        weeks = Math.max(weeks, week + 1);
        return { week, day: offset % 7, level: clampLevel(d.level), count: d.count, date: d.date };
    });
    return { login, weeks, cells };
}
export async function fetchPublicLawn(login, signal) {
    const res = await fetch(`${MIRROR}${encodeURIComponent(login)}?y=last`, { signal });
    if (res.status === 404)
        throw new Error(`github user "${login}" not found`);
    if (!res.ok)
        throw new Error(`contributions mirror returned ${res.status} ${res.statusText}`);
    const json = (await res.json());
    if (!Array.isArray(json.contributions))
        throw new Error("contributions mirror returned no days");
    return lawnFromDays(login, json.contributions);
}
