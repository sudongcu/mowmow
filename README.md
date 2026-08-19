# mowmow

> touch grass. or at least mow it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/sudongcu/mowmow/output/lawn-dark.svg" />
  <img alt="sudongcu's contribution lawn, freshly mowed" src="https://raw.githubusercontent.com/sudongcu/mowmow/output/lawn.svg" />
</picture>

your github contribution graph, as a lawn. a mower crosses it row by row —
the way you actually mow a lawn — cutting every tuft it passes. each tuft
springs back at a speed set by that day's commits: heavy days recover almost
instantly, light days stay flat a while, and days with no commits are bare
dirt that just puffs up dust as the mower rolls over.

and it never finishes. the mow loops forever — **the lawn always grows back,
as long as you keep committing.**

no server, no javascript, no gif — one animated SVG (SMIL), rendered daily by
a github action and served straight from your repo.

## get your own lawn

easiest: use the [playground](https://sudongcu.github.io/mowmow/) — type your
username, eyeball the preview, copy two snippets. or by hand:

**1.** drop this in your profile repo (`<username>/<username>`) as
`.github/workflows/mow.yml`:

```yaml
name: mow
on:
  schedule:
    - cron: "0 3 * * *"
  workflow_dispatch:
permissions:
  contents: write
jobs:
  mow:
    runs-on: ubuntu-latest
    steps:
      - uses: sudongcu/mowmow@main
        with:
          github_user_name: <your-username>
          # cycle: "45"              # seconds per mow-and-regrow loop (min 28)
          # mower: goat              # push | riding | goat
          # mower_color: "#ff69b4"   # hex color for the mower body / goat coat
```

**2.** put the lawn in your README:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/<you>/<you>/output/lawn-dark.svg" />
  <img alt="my contribution lawn" src="https://raw.githubusercontent.com/<you>/<you>/output/lawn.svg" />
</picture>
```

**3.** run it once from the actions tab (`mow` → run workflow). after that it
re-mows itself every day. that's the whole setup — no token to create
(actions provides one), no server, nothing to install. the generated SVGs
live on an orphan `output` branch, so your main history stays clean.

heads-up: the lawn shows your *public* contributions. if yours looks
suspiciously bare, see [my lawn is mostly dirt?](#my-lawn-is-mostly-dirt).

## options

| input | default | what it does |
|---|---|---|
| `github_user_name` | — | whose lawn (required) |
| `cycle` | `30` | seconds per mow-and-regrow loop. 28 is the floor — shorter and the last row can't regrow in time, so timings get clamped (with a warning). no hard ceiling; 30–90 looks right |
| `theme` | `light` | `light` or `dark` |
| `mower` | `push` | `push`, `riding`, or `goat` — the goat doesn't cut your lawn, it eats it. same thing |
| `mower_color` | theme default | any hex color for the mower body (or the goat's coat), e.g. `#ff8800` |
| `outputs` | light + dark pair | newline-separated files (relative to the branch root), each with optional `?theme=&cycle=&weeks=&mower=&mower_color=&stripes=` overrides |
| `target_branch` | `output` | where the files get force-pushed, as a single orphan commit |
| `push` | `true` | set `false` to only stage files in `mowmow/` and handle publishing yourself |
| `github_token` | `github.token` | reads the calendar, pushes the branch — the auto-provided one is enough, unless your commits are mostly private ([see below](#my-lawn-is-mostly-dirt)) |

## customize

the easy way is the [playground](https://sudongcu.github.io/mowmow/): pick a
mower, pick a color, watch the preview, copy the yaml it writes for you.

already installed? customizing is editing the `with:` block in your
`.github/workflows/mow.yml`, committing, and running the workflow once
(or just waiting for tomorrow's mow). some starting points:

```yaml
# the pink goat
with:
  github_user_name: <you>
  mower: goat
  mower_color: "#ff69b4"
```

```yaml
# a blue riding mower on leisurely 45-second laps
with:
  github_user_name: <you>
  mower: riding
  mower_color: "#2f6fed"
  cycle: "45"
```

```yaml
# mix per file: classic light lawn, goat on the dark one,
# plus a short stripeless one for a project readme
with:
  github_user_name: <you>
  outputs: |
    lawn.svg
    lawn-dark.svg?theme=dark&mower=goat
    lawn-small.svg?weeks=26&stripes=false
```

every `outputs` line is its own lawn — anything from the options table works
as a `?key=value` override, so one run can mow as many variants as you want.
(one thing to know: `cycle` under 28s doesn't leave the last row enough time
to regrow, so the renderer will clamp it and grumble.)

## my lawn is mostly dirt?

the lawn shows what the api hands a stranger: your *public* contributions.
if most of your commits live in private repos, the default token renders a
4,000-contribution year as a desert with three brave tufts.

the profile toggle (**contribution settings → private contributions**)
won't fix it — that only changes the graph on github.com. the api keeps
private contributions hidden from everyone but you, so the action has to
read the calendar *as you*:

1. create a [classic PAT with the `repo` scope](https://github.com/settings/tokens/new?scopes=repo&description=mowmow)
2. add it to your profile repo as a secret named `MOWMOW_TOKEN`
   (repo **settings → secrets and variables → actions → new repository secret**)
3. hand it to the action:

```yaml
with:
  github_user_name: <you>
  github_token: ${{ secrets.MOWMOW_TOKEN }}
```

then re-run the workflow once (actions tab → `mow` → run workflow) instead
of waiting for tomorrow's mow. if the readme still shows the old lawn
after that, it's github's image cache — give it five minutes and refresh.

## cli

work on a lawn locally without an action run:

```bash
npm install
npx tsx src/cli.ts <login> --demo true          # synthetic data, no token
GITHUB_TOKEN=... npx tsx src/cli.ts <login>     # the real thing

  --out <path>       output file (default <login>-lawn.svg)
  --theme <t>        light | dark (default light)
  --cycle <sec>      seconds per loop (default 30, don't go under 28)
  --weeks <n>        only the most recent n weeks
  --mower <m>        push | riding | goat (default push)
  --mower-color <c>  hex color for the mower body / goat coat
  --stripes false    disable the cut stripe bands
```

## how it works

`animateMotion` distributes a path over its duration by arc length, so the
mower moves at constant speed — a tuft's cut time is just its distance along
the mower's boustrophedon path divided by the total length. the blades line up
with the grass exactly, no per-cell tuning. the mower spends 78% of the loop
cutting; the rest is regrow tail, so the lawn is whole again before the loop
restarts. a full year of lawn is ~150 KB of SVG that gzips to ~9 KB, and
github's image proxy serves it gzipped.

## license

[mit](LICENSE). fork it, self-host it. the goat is already on it — `mower: goat`.
