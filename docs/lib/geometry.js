export const COL = 15;
export const ROW = 26;
export const MARGIN_X = 14;
export const MARGIN_TOP = 18;
export const MARGIN_BOTTOM = 16;
export const DAYS = 7;
export const MOW_FRACTION = 0.78;
export const REGROW_DURATION = 0.9;
export const OVERHANG = 28;
export function canvasWidth(weeks) {
    return MARGIN_X * 2 + weeks * COL;
}
export function canvasHeight() {
    return MARGIN_TOP + DAYS * ROW + MARGIN_BOTTOM;
}
export function cellCenterX(week) {
    return MARGIN_X + week * COL + COL / 2;
}
export function rowBaselineY(day) {
    return MARGIN_TOP + (day + 1) * ROW;
}
function pathEndpoints(weeks) {
    return { xStart: -OVERHANG, xEnd: canvasWidth(weeks) + OVERHANG };
}
export function mowerPath(weeks) {
    const { xStart, xEnd } = pathEndpoints(weeks);
    const parts = [`M ${xStart} ${rowBaselineY(0)}`];
    for (let d = 0; d < DAYS; d++) {
        parts.push(`L ${d % 2 === 0 ? xEnd : xStart} ${rowBaselineY(d)}`);
        if (d < DAYS - 1)
            parts.push(`L ${d % 2 === 0 ? xEnd : xStart} ${rowBaselineY(d + 1)}`);
    }
    return parts.join(" ");
}
export function totalPathLength(weeks) {
    const { xStart, xEnd } = pathEndpoints(weeks);
    return DAYS * (xEnd - xStart) + (DAYS - 1) * ROW;
}
export function cutFraction(week, day, weeks) {
    const { xStart, xEnd } = pathEndpoints(weeks);
    const run = xEnd - xStart;
    const cx = cellCenterX(week);
    const within = day % 2 === 0 ? cx - xStart : xEnd - cx;
    const dist = day * (run + ROW) + within;
    return (dist / totalPathLength(weeks)) * MOW_FRACTION;
}
export function flipFractions(weeks) {
    const { xStart, xEnd } = pathEndpoints(weeks);
    const run = xEnd - xStart;
    const total = totalPathLength(weeks);
    const out = [];
    for (let k = 1; k < DAYS; k++) {
        out.push(((k * (run + ROW) - ROW / 2) / total) * MOW_FRACTION);
    }
    return out;
}
