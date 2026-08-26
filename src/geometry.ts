/** horizontal pitch between week columns */
export const COL = 15;
/** vertical pitch between day rows */
export const ROW = 26;
export const MARGIN_X = 14;
export const MARGIN_TOP = 18;
export const MARGIN_BOTTOM = 16;
export const DAYS = 7;
/** seconds a tuft takes to spring back once its regrow delay has passed */
export const REGROW_DURATION = 0.9;
/**
 * How far past the canvas edge the mower drives on every pass. The row-to-row
 * hop happens out there, off-canvas, so the mower always re-enters cleanly —
 * and it parks off-screen during the regrow tail instead of teleporting.
 */
export const OVERHANG = 28;

export function canvasWidth(weeks: number): number {
  return MARGIN_X * 2 + weeks * COL;
}

export function canvasHeight(): number {
  return MARGIN_TOP + DAYS * ROW + MARGIN_BOTTOM;
}

export function cellCenterX(week: number): number {
  return MARGIN_X + week * COL + COL / 2;
}

/** the ground line a row's tufts stand on, and the line the mower rides */
export function rowBaselineY(day: number): number {
  return MARGIN_TOP + (day + 1) * ROW;
}

function pathEndpoints(weeks: number): { xStart: number; xEnd: number } {
  return { xStart: -OVERHANG, xEnd: canvasWidth(weeks) + OVERHANG };
}

/**
 * Boustrophedon: row 0 left→right, row 1 right→left, and so on — the way you
 * actually mow a lawn. Straight segments only, so arc length is exact.
 */
export function mowerPath(weeks: number): string {
  const { xStart, xEnd } = pathEndpoints(weeks);
  const parts = [`M ${xStart} ${rowBaselineY(0)}`];
  for (let d = 0; d < DAYS; d++) {
    parts.push(`L ${d % 2 === 0 ? xEnd : xStart} ${rowBaselineY(d)}`);
    if (d < DAYS - 1) parts.push(`L ${d % 2 === 0 ? xEnd : xStart} ${rowBaselineY(d + 1)}`);
  }
  return parts.join(" ");
}

export function totalPathLength(weeks: number): number {
  const { xStart, xEnd } = pathEndpoints(weeks);
  return DAYS * (xEnd - xStart) + (DAYS - 1) * ROW;
}

/**
 * How far along the mower's path a cell sits, as a fraction of the whole path.
 * animateMotion distributes the path by arc length, so a tuft's cut time is
 * just this times the seconds the mower spends cutting.
 */
export function cutFraction(week: number, day: number, weeks: number): number {
  const { xStart, xEnd } = pathEndpoints(weeks);
  const run = xEnd - xStart;
  const cx = cellCenterX(week);
  const within = day % 2 === 0 ? cx - xStart : xEnd - cx;
  const dist = day * (run + ROW) + within;
  return dist / totalPathLength(weeks);
}

/** path fractions at which the mower turns around (midpoint of each off-canvas hop) */
export function flipFractions(weeks: number): number[] {
  const { xStart, xEnd } = pathEndpoints(weeks);
  const run = xEnd - xStart;
  const total = totalPathLength(weeks);
  const out: number[] = [];
  for (let k = 1; k < DAYS; k++) {
    out.push((k * (run + ROW) - ROW / 2) / total);
  }
  return out;
}
