import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fetchLawn } from "./contributions.js";
import { demoLawn } from "./demo.js";
import { renderLawn } from "./render.js";
import type { MowerStyle, Theme } from "./types.js";

const USAGE = `usage: npx tsx src/cli.ts <login> [options]

  --out <path>       output file (default <login>-lawn.svg)
  --theme <t>        light | dark (default light)
  --cycle <sec>      seconds per mow-and-regrow loop (default 30, min 15 —
                     shorter gets clamped with a warning)
  --weeks <n>        only the most recent n weeks (1-53)
  --mower <m>        push | riding | goat (default push)
  --mower-color <c>  hex color for the mower body / goat coat, e.g. "#ff8800"
  --stripes false    disable the cut stripe bands
  --demo true        synthetic data, no token needed

  GITHUB_TOKEN required unless --demo`;

interface Args {
  login: string;
  out?: string;
  theme: Theme;
  cycle: number;
  weeks?: number;
  mower: MowerStyle;
  mowerColor?: string;
  stripes: boolean;
  demo: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { login: "", theme: "light", cycle: 30, mower: "push", stripes: true, demo: false };
  const takeValue = (i: number, flag: string): string => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) {
      throw new Error(`${flag} needs a value`);
    }
    return v;
  };
  const takeBool = (i: number): { value: boolean; used: boolean } => {
    const v = argv[i + 1];
    if (v === "true" || v === "false") return { value: v === "true", used: true };
    return { value: true, used: false };
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--help":
      case "-h":
        console.log(USAGE);
        process.exit(0);
      case "--out":
        args.out = takeValue(i, a);
        i++;
        break;
      case "--theme": {
        const t = takeValue(i, a);
        if (t !== "light" && t !== "dark") throw new Error(`--theme must be light or dark, got "${t}"`);
        args.theme = t;
        i++;
        break;
      }
      case "--cycle": {
        const c = Number(takeValue(i, a));
        if (!(c > 0)) throw new Error("--cycle must be a positive number of seconds");
        args.cycle = c;
        i++;
        break;
      }
      case "--weeks": {
        const n = Number(takeValue(i, a));
        if (!Number.isInteger(n) || n < 1) throw new Error("--weeks must be a positive integer");
        args.weeks = n;
        i++;
        break;
      }
      case "--mower": {
        const m = takeValue(i, a);
        if (m !== "push" && m !== "riding" && m !== "goat") {
          throw new Error(`--mower must be push, riding, or goat, got "${m}"`);
        }
        args.mower = m;
        i++;
        break;
      }
      case "--mower-color":
        args.mowerColor = takeValue(i, a);
        i++;
        break;
      case "--stripes": {
        const b = takeBool(i);
        args.stripes = b.value;
        if (b.used) i++;
        break;
      }
      case "--demo": {
        const b = takeBool(i);
        args.demo = b.value;
        if (b.used) i++;
        break;
      }
      default:
        if (a.startsWith("--")) throw new Error(`unknown option ${a}`);
        if (args.login) throw new Error(`unexpected argument "${a}"`);
        args.login = a;
    }
  }
  if (!args.login) {
    console.error(USAGE);
    process.exit(1);
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  let lawn;
  if (args.demo) {
    lawn = demoLawn(args.login);
  } else {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN is not set — export it, or pass --demo true for synthetic data");
    }
    lawn = await fetchLawn(args.login, token);
  }

  const warnings: string[] = [];
  const svg = renderLawn(lawn, {
    theme: args.theme,
    cycle: args.cycle,
    weeks: args.weeks,
    mower: args.mower,
    mowerColor: args.mowerColor,
    stripes: args.stripes,
    onWarn: (w) => warnings.push(w),
  });

  const out = args.out ?? `${args.login}-lawn.svg`;
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, svg, "utf8");

  const raw = Buffer.byteLength(svg);
  const gz = gzipSync(Buffer.from(svg)).length;
  console.log(`wrote ${out} — ${(raw / 1024).toFixed(1)} KB raw, ${(gz / 1024).toFixed(1)} KB gzipped`);
  for (const w of warnings) console.warn(`warning: ${w}`);
}

main().catch((e: Error) => {
  console.error(`error: ${e.message}`);
  process.exit(1);
});
