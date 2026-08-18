export type Level = 0 | 1 | 2 | 3 | 4;

export interface Cell {
  /** column index, 0 = oldest week */
  week: number;
  /** row index, 0 = Sunday */
  day: number;
  level: Level;
  count?: number;
  date?: string;
}

export interface Lawn {
  login: string;
  weeks: number;
  cells: Cell[];
}

export type Theme = "light" | "dark";

export type MowerStyle = "push" | "riding" | "goat";

export interface Palette {
  dirt: string;
  grass: [string, string, string, string];
  mower: string;
  wheel: string;
  handle: string;
  stripe: string;
  stripeOpacity: number;
  dust: string;
  goatBody: string;
  goatDetail: string;
}

export interface RenderOptions {
  theme?: Theme;
  /** seconds per mow-and-regrow loop */
  cycle?: number;
  /** cut stripe bands on alternating rows */
  stripes?: boolean;
  /** what does the mowing: a push mower, a riding mower, or a goat */
  mower?: MowerStyle;
  /** hex color for the mower body (or the goat's coat), e.g. "#ff8800" */
  mowerColor?: string;
  /** trim to the most recent n weeks */
  weeks?: number;
  onWarn?: (message: string) => void;
}
