import type { Cell, Lawn, Level, MowerStyle, Palette, RenderOptions, Theme } from "./types.js";
import {
  DAYS,
  MOW_FRACTION,
  REGROW_DURATION,
  canvasHeight,
  canvasWidth,
  cellCenterX,
  cutFraction,
  flipFractions,
  mowerPath,
  rowBaselineY,
  COL,
  MARGIN_X,
  ROW,
} from "./geometry.js";

export const PALETTES: Record<Theme, Palette> = {
  light: {
    dirt: "#8a6b45",
    grass: ["#b5d688", "#83c25e", "#4f9c3c", "#2f7d2f"],
    mower: "#d94f3d",
    wheel: "#3a3a3a",
    handle: "#4a4a4a",
    stripe: "#000000",
    stripeOpacity: 0.045,
    dust: "#a98a5f",
    goatBody: "#e7e0d0",
    goatDetail: "#8c8474",
  },
  dark: {
    dirt: "#43362a",
    grass: ["#0e4429", "#006d32", "#26a641", "#39d353"],
    mower: "#e05a45",
    wheel: "#8b949e",
    handle: "#8b949e",
    stripe: "#ffffff",
    stripeOpacity: 0.05,
    dust: "#5c4a37",
    goatBody: "#d0c9b8",
    goatDetail: "#6e675a",
  },
};

const BLADE_HEIGHT: Record<Exclude<Level, 0>, number> = { 1: 10, 2: 15, 3: 20, 4: 24 };
const REGROW_DELAY: Record<Exclude<Level, 0>, number> = { 1: 5.2, 2: 4.0, 3: 2.8, 4: 1.6 };
/** seconds the cut itself takes — near-instant snap under the blade */
const CUT_SNAP = 0.06;

/** shortest cycle whose last-row regrow still fits inside the loop */
export function minCycle(): number {
  const tail = CUT_SNAP + REGROW_DELAY[1] + REGROW_DURATION;
  return Math.ceil(tail / (1 - MOW_FRACTION));
}

const nf = (v: number, p = 2): string => {
  let s = v.toFixed(p);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s === "-0" ? "0" : s;
};

interface Keyframe {
  /** seconds into the cycle */
  t: number;
  v: string;
}

/**
 * Turn keyframes into keyTimes/values. keyTimes must be strictly increasing
 * and end at exactly 1; short cycles push the last row's regrow past 1.0, so
 * clamp from the back and report whether anything had to move.
 */
function timeline(frames: Keyframe[], cycle: number): { keyTimes: string; values: string; clamped: boolean } {
  const EPS = 1e-4;
  const n = frames.length;
  const f = frames.map((k) => k.t / cycle);
  f[0] = 0;
  f[n - 1] = 1;
  let clamped = false;
  for (let i = n - 2; i >= 1; i--) {
    if (f[i] > f[i + 1] - EPS) {
      f[i] = f[i + 1] - EPS;
      clamped = true;
    }
  }
  for (let i = 1; i < n; i++) {
    if (f[i] <= f[i - 1]) {
      // cycle absurdly short — fall back to an even spread, still valid SMIL
      for (let j = 0; j < n; j++) f[j] = j / (n - 1);
      clamped = true;
      break;
    }
  }
  return {
    keyTimes: f.map((v) => nf(v, 5)).join(";"),
    values: frames.map((k) => k.v).join(";"),
    clamped,
  };
}

function trimLawn(lawn: Lawn, weeks?: number): Lawn {
  if (!weeks || weeks >= lawn.weeks) return lawn;
  const offset = lawn.weeks - weeks;
  return {
    login: lawn.login,
    weeks,
    cells: lawn.cells
      .filter((c) => c.week >= offset)
      .map((c) => ({ ...c, week: c.week - offset })),
  };
}

/** accepts "#ff8800", "ff8800", "#f80"; returns normalized "#…" or null */
export function normalizeHexColor(c: string): string | null {
  const s = c.trim().replace(/^#/, "");
  return /^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? `#${s.toLowerCase()}` : null;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tuftSvg(cell: Cell, weeks: number, palette: Palette, cycle: number, clampedRef: { count: number }): string {
  const level = cell.level as Exclude<Level, 0>;
  const h = BLADE_HEIGHT[level];
  const color = palette.grass[level - 1];
  const cx = cellCenterX(cell.week);
  const y = rowBaselineY(cell.day);
  const cutT = cutFraction(cell.week, cell.day, weeks) * cycle;
  const cutScale = Math.min(0.3, Math.max(0.1, 2.8 / h));
  const regrowStart = cutT + REGROW_DELAY[level];
  const tl = timeline(
    [
      { t: 0, v: "1 1" },
      { t: cutT, v: "1 1" },
      { t: cutT + CUT_SNAP, v: `1 ${nf(cutScale)}` },
      { t: regrowStart, v: `1 ${nf(cutScale)}` },
      { t: regrowStart + REGROW_DURATION * 0.6, v: "1 1.12" },
      { t: regrowStart + REGROW_DURATION, v: "1 1" },
      { t: cycle, v: "1 1" },
    ],
    cycle,
  );
  if (tl.clamped) clampedRef.count++;
  return (
    `<g transform="translate(${nf(cx)} ${y})"><g>` +
    `<polygon points="-4.6,0 -3.1,${nf(-0.7 * h)} -1.6,0" fill="${color}"/>` +
    `<polygon points="-1.9,0 0.2,${-h} 2,0" fill="${color}"/>` +
    `<polygon points="1.6,0 3.4,${nf(-0.78 * h)} 4.8,0" fill="${color}"/>` +
    `<animateTransform attributeName="transform" type="scale" calcMode="linear" additive="sum" ` +
    `dur="${nf(cycle)}s" repeatCount="indefinite" values="${tl.values}" keyTimes="${tl.keyTimes}"/>` +
    `</g></g>`
  );
}

function dirtSvg(cell: Cell, weeks: number, palette: Palette, cycle: number): string {
  const cx = cellCenterX(cell.week);
  const y = rowBaselineY(cell.day);
  const cutT = cutFraction(cell.week, cell.day, weeks) * cycle;
  const fade = timeline(
    [
      { t: 0, v: "0" },
      { t: cutT, v: "0" },
      { t: cutT + 0.12, v: "0.5" },
      { t: cutT + 0.7, v: "0" },
      { t: cycle, v: "0" },
    ],
    cycle,
  );
  const rise = timeline(
    [
      { t: 0, v: "0 0" },
      { t: cutT, v: "0 0" },
      { t: cutT + 0.7, v: "0 -7" },
      { t: cycle, v: "0 -7" },
    ],
    cycle,
  );
  return (
    `<g transform="translate(${nf(cx)} ${y})">` +
    `<ellipse cx="0" cy="-1" rx="4.4" ry="1.7" fill="${palette.dirt}"/>` +
    `<circle cx="3.4" cy="-0.8" r="0.9" fill="${palette.dirt}" opacity="0.7"/>` +
    `<g opacity="0">` +
    `<circle cx="-2" cy="-3" r="1.8" fill="${palette.dust}"/>` +
    `<circle cx="2.4" cy="-4.6" r="1.3" fill="${palette.dust}"/>` +
    `<animate attributeName="opacity" calcMode="linear" dur="${nf(cycle)}s" repeatCount="indefinite" ` +
    `values="${fade.values}" keyTimes="${fade.keyTimes}"/>` +
    `<animateTransform attributeName="transform" type="translate" calcMode="linear" dur="${nf(cycle)}s" ` +
    `repeatCount="indefinite" values="${rise.values}" keyTimes="${rise.keyTimes}"/>` +
    `</g></g>`
  );
}

function stripesSvg(weeks: number, palette: Palette): string {
  const parts: string[] = [];
  for (let d = 1; d < DAYS; d += 2) {
    parts.push(
      `<rect x="${MARGIN_X}" y="${rowBaselineY(d) - ROW}" width="${weeks * COL}" height="${ROW}" ` +
        `fill="${palette.stripe}" opacity="${nf(palette.stripeOpacity, 3)}"/>`,
    );
  }
  return parts.join("");
}

// sprites face right, origin at the ground under the wheels (or hooves)
function pushSprite(p: Palette): string {
  return (
    `<path d="M -5 -12 L -12.5 -22" stroke="${p.handle}" stroke-width="1.8" stroke-linecap="round" fill="none"/>` +
    `<path d="M -14.6 -23.4 L -11.6 -21.2" stroke="${p.handle}" stroke-width="2.6" stroke-linecap="round" fill="none"/>` +
    `<rect x="-8.5" y="-12.5" width="17" height="8" rx="2.5" fill="${p.mower}"/>` +
    `<rect x="-8.5" y="-8.2" width="17" height="3.7" rx="1.8" fill="#000" fill-opacity="0.18"/>` +
    `<rect x="1.5" y="-15.5" width="5" height="4" rx="1.2" fill="${p.mower}"/>` +
    `<rect x="6.8" y="-6.8" width="4.4" height="5" rx="1" fill="${p.handle}"/>` +
    `<circle cx="-5" cy="-3" r="3" fill="${p.wheel}"/>` +
    `<circle cx="5" cy="-3" r="3" fill="${p.wheel}"/>` +
    `<circle cx="-5" cy="-3" r="1.1" fill="#fff" fill-opacity="0.35"/>` +
    `<circle cx="5" cy="-3" r="1.1" fill="#fff" fill-opacity="0.35"/>`
  );
}

function ridingSprite(p: Palette): string {
  return (
    `<circle cx="-6.5" cy="-4.8" r="4.8" fill="${p.wheel}"/>` +
    `<circle cx="-6.5" cy="-4.8" r="1.7" fill="#fff" fill-opacity="0.35"/>` +
    `<circle cx="7.5" cy="-3.2" r="3.2" fill="${p.wheel}"/>` +
    `<circle cx="7.5" cy="-3.2" r="1.1" fill="#fff" fill-opacity="0.35"/>` +
    `<rect x="10" y="-5.5" width="3.6" height="4" rx="1" fill="${p.handle}"/>` +
    `<rect x="-10.5" y="-13.5" width="20" height="7" rx="2" fill="${p.mower}"/>` +
    `<rect x="-10.5" y="-9.7" width="20" height="3.2" rx="1.6" fill="#000" fill-opacity="0.18"/>` +
    `<rect x="-10" y="-20" width="5" height="7" rx="1.6" fill="${p.handle}"/>` +
    `<path d="M 2 -13.5 L 0.2 -17.8" stroke="${p.handle}" stroke-width="1.6" stroke-linecap="round" fill="none"/>` +
    `<circle cx="0" cy="-18.4" r="1.7" fill="${p.handle}"/>`
  );
}

function goatSprite(p: Palette): string {
  return (
    `<polygon points="-7.4,-11.6 -10.4,-14 -6.6,-10" fill="${p.goatDetail}"/>` +
    `<rect x="-6.4" y="-5.6" width="1.7" height="5.6" rx="0.8" fill="${p.goatDetail}"/>` +
    `<rect x="-3.2" y="-5.6" width="1.7" height="5.6" rx="0.8" fill="${p.goatDetail}"/>` +
    `<rect x="2" y="-5.6" width="1.7" height="5.6" rx="0.8" fill="${p.goatDetail}"/>` +
    `<rect x="4.9" y="-5.6" width="1.7" height="5.6" rx="0.8" fill="${p.goatDetail}"/>` +
    `<ellipse cx="0" cy="-9.5" rx="7.6" ry="4.8" fill="${p.goatBody}"/>` +
    // grazing pose: head down in the grass, horns swept back
    `<path d="M 7.6 -8.8 C 6.6 -12 8.2 -13.4 9.8 -12.6" stroke="${p.goatDetail}" stroke-width="1.3" stroke-linecap="round" fill="none"/>` +
    `<ellipse cx="9" cy="-6.4" rx="3" ry="2.6" fill="${p.goatBody}"/>` +
    `<ellipse cx="6.9" cy="-8.2" rx="1.6" ry="0.9" fill="${p.goatDetail}"/>` +
    `<circle cx="9.9" cy="-7.1" r="0.55" fill="#222222"/>` +
    `<polygon points="10.6,-4.6 11.3,-1.8 9.5,-4.2" fill="${p.goatDetail}"/>`
  );
}

const SPRITES: Record<MowerStyle, (p: Palette) => string> = {
  push: pushSprite,
  riding: ridingSprite,
  goat: goatSprite,
};

function mowerSvg(weeks: number, palette: Palette, cycle: number, style: MowerStyle): string {
  const sprite = SPRITES[style](palette);
  const flips = flipFractions(weeks);
  const flipValues = ["1 1"];
  const flipTimes = ["0"];
  flips.forEach((f, i) => {
    flipValues.push(i % 2 === 0 ? "-1 1" : "1 1");
    flipTimes.push(nf(f, 5));
  });
  return (
    `<g><g>` +
    sprite +
    `<animateTransform attributeName="transform" type="scale" calcMode="discrete" dur="${nf(cycle)}s" ` +
    `repeatCount="indefinite" values="${flipValues.join(";")}" keyTimes="${flipTimes.join(";")}"/>` +
    `</g>` +
    `<animateMotion dur="${nf(cycle)}s" repeatCount="indefinite" rotate="0" calcMode="linear" ` +
    `keyPoints="0;1;1" keyTimes="0;${nf(MOW_FRACTION, 5)};1" path="${mowerPath(weeks)}"/>` +
    `</g>`
  );
}

export function renderLawn(lawn: Lawn, options: RenderOptions = {}): string {
  const theme = options.theme ?? "light";
  const cycle = options.cycle ?? 30;
  const stripes = options.stripes ?? true;
  const mower = options.mower ?? "push";
  const warn = options.onWarn ?? (() => {});
  if (!(cycle > 0)) throw new Error(`cycle must be a positive number of seconds, got ${cycle}`);

  const trimmed = trimLawn(lawn, options.weeks);
  const { weeks } = trimmed;
  let palette = PALETTES[theme];
  if (options.mowerColor) {
    const hex = normalizeHexColor(options.mowerColor);
    if (!hex) throw new Error(`mower_color must be a hex color like #ff8800, got "${options.mowerColor}"`);
    palette = { ...palette, mower: hex, goatBody: hex };
  }
  const width = canvasWidth(weeks);
  const height = canvasHeight();
  const clampedRef = { count: 0 };

  const cells = [...trimmed.cells].sort((a, b) => a.day - b.day || a.week - b.week);
  const dirt: string[] = [];
  const tufts: string[] = [];
  for (const cell of cells) {
    if (cell.level === 0) dirt.push(dirtSvg(cell, weeks, palette, cycle));
    else tufts.push(tuftSvg(cell, weeks, palette, cycle, clampedRef));
  }

  if (clampedRef.count > 0) {
    warn(
      `cycle=${cycle}s is too short for the regrow tail — ${clampedRef.count} tuft timeline(s) got squeezed. ` +
        `use --cycle ${minCycle()} or longer.`,
    );
  }

  const login = escapeXml(trimmed.login);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img" aria-label="@${login}'s contribution lawn, mowed by mowmow">` +
    `<title>@${login}'s lawn</title>` +
    `<desc>github contributions as grass: the mower cuts row by row, and every tuft grows back at the speed of that day's commits.</desc>` +
    dirt.join("") +
    tufts.join("") +
    (stripes ? stripesSvg(weeks, palette) : "") +
    mowerSvg(weeks, palette, cycle, mower) +
    `</svg>`
  );
}
