function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function mulberry32(seed) {
    let a = seed | 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function demoLawn(login = "demo", weeks = 53) {
    const rnd = mulberry32(hashString(login || "demo") || 1);
    const phase = rnd() * Math.PI * 2;
    const vacationWeeks = new Set();
    const vacations = 1 + Math.floor(rnd() * 2);
    for (let v = 0; v < vacations; v++) {
        const start = 4 + Math.floor(rnd() * Math.max(1, weeks - 8));
        vacationWeeks.add(start);
        vacationWeeks.add(start + 1);
    }
    const streakStart = Math.floor(rnd() * Math.max(1, weeks - 6));
    const cells = [];
    for (let w = 0; w < weeks; w++) {
        const season = 0.55 + 0.3 * Math.sin((w / weeks) * Math.PI * 4 + phase);
        let weekBase = season * (0.7 + rnd() * 0.6);
        if (vacationWeeks.has(w))
            weekBase = 0;
        if (w >= streakStart && w < streakStart + 4)
            weekBase *= 1.8;
        for (let d = 0; d < 7; d++) {
            const weekend = d === 0 || d === 6;
            const i = weekBase * (weekend ? 0.35 : 1) * (0.6 + rnd() * 0.8);
            const level = i < 0.12 ? 0 : i < 0.3 ? 1 : i < 0.5 ? 2 : i < 0.78 ? 3 : 4;
            cells.push({ week: w, day: d, level });
        }
    }
    return { login, weeks, cells };
}
