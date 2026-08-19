import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fetchLawn } from "./contributions.js";
import { renderLawn } from "./render.js";
import type { MowerStyle, RenderOptions, Theme } from "./types.js";

const MOWERS: MowerStyle[] = ["push", "riding", "goat"];

function getInput(name: string): string {
  return (process.env[`INPUT_${name.toUpperCase()}`] ?? "").trim();
}

interface OutputSpec {
  file: string;
  options: RenderOptions;
}

/** each line is a file path, optionally with overrides: `lawn.svg?theme=dark&mower=goat&mower_color=ff8800` */
function parseOutputs(
  raw: string,
  defaults: { theme: Theme; cycle: number; mower: MowerStyle; mowerColor?: string },
): OutputSpec[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const q = line.indexOf("?");
      const file = q === -1 ? line : line.slice(0, q);
      const params = new URLSearchParams(q === -1 ? "" : line.slice(q + 1));
      const options: RenderOptions = {
        theme: defaults.theme,
        cycle: defaults.cycle,
        mower: defaults.mower,
        mowerColor: defaults.mowerColor,
        stripes: true,
      };
      const theme = params.get("theme");
      if (theme) {
        if (theme !== "light" && theme !== "dark") throw new Error(`bad theme "${theme}" in output "${line}"`);
        options.theme = theme;
      }
      const cycle = params.get("cycle");
      if (cycle) {
        const c = Number(cycle);
        if (!(c > 0)) throw new Error(`bad cycle "${cycle}" in output "${line}"`);
        options.cycle = c;
      }
      const weeks = params.get("weeks");
      if (weeks) {
        const n = Number(weeks);
        if (!Number.isInteger(n) || n < 1) throw new Error(`bad weeks "${weeks}" in output "${line}"`);
        options.weeks = n;
      }
      const mower = params.get("mower");
      if (mower) {
        if (!MOWERS.includes(mower as MowerStyle)) throw new Error(`bad mower "${mower}" in output "${line}"`);
        options.mower = mower as MowerStyle;
      }
      const mowerColor = params.get("mower_color");
      if (mowerColor) options.mowerColor = mowerColor;
      if (params.get("stripes") === "false") options.stripes = false;
      return { file, options };
    });
}

async function run(): Promise<void> {
  const user = getInput("github_user_name");
  if (!user) throw new Error("input github_user_name is required");

  const token = getInput("github_token") || process.env.GITHUB_TOKEN;
  if (!token) throw new Error("no token — set the github_token input or the GITHUB_TOKEN env var");

  const theme = (getInput("theme") || "light") as Theme;
  if (theme !== "light" && theme !== "dark") throw new Error(`input theme must be light or dark, got "${theme}"`);
  const cycle = Number(getInput("cycle") || "30");
  if (!(cycle > 0)) throw new Error("input cycle must be a positive number of seconds");
  const mower = (getInput("mower") || "push") as MowerStyle;
  if (!MOWERS.includes(mower)) throw new Error(`input mower must be push, riding, or goat, got "${mower}"`);
  const mowerColor = getInput("mower_color") || undefined;

  const outputsRaw = getInput("outputs") || "lawn.svg\nlawn-dark.svg?theme=dark";
  const outputs = parseOutputs(outputsRaw, { theme, cycle, mower, mowerColor });
  const push = (getInput("push") || "true").toLowerCase() !== "false";
  const branch = getInput("target_branch") || "output";

  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  // output paths are relative to this staging dir, which becomes the branch root
  const stageDir = path.resolve(workspace, "mowmow");
  fs.rmSync(stageDir, { recursive: true, force: true });

  const lawn = await fetchLawn(user, token);
  console.log(`fetched ${lawn.weeks} weeks of contributions for @${user}`);

  for (const spec of outputs) {
    const target = path.resolve(stageDir, spec.file);
    if (!target.startsWith(stageDir)) {
      throw new Error(`output path escapes the staging dir: ${spec.file}`);
    }
    const svg = renderLawn(lawn, {
      ...spec.options,
      onWarn: (w) => console.log(`::warning::${w}`),
    });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, svg, "utf8");
    console.log(`wrote mowmow/${spec.file} (${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB)`);
  }

  if (!push) {
    console.log("push=false — files are staged in mowmow/, not pushed");
    return;
  }

  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error("GITHUB_REPOSITORY is not set — is this running outside github actions?");
  const server = process.env.GITHUB_SERVER_URL || "https://github.com";
  const remote =
    process.env.MOWMOW_REMOTE || `${server.replace("://", `://x-access-token:${token}@`)}/${repo}.git`;
  const git = (...args: string[]): void => {
    execFileSync("git", args, { cwd: stageDir, stdio: ["ignore", "inherit", "inherit"] });
  };
  // a fresh single-commit repo every run keeps `output` an orphan branch:
  // force-pushing it never grows anyone's history
  git("init", "-q", "-b", branch);
  // the actions bot identity — an invented "mowmow" email would get
  // attributed to the real github user of that name
  git("config", "user.name", "github-actions[bot]");
  git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
  git("add", ".");
  git("commit", "-q", "-m", "mow");
  git("push", "-q", "-f", remote, branch);
  console.log(`pushed ${outputs.length} file(s) to the ${branch} branch`);
}

run().catch((e: Error) => {
  console.log(`::error::${e.message}`);
  process.exit(1);
});
