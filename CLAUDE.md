# CLAUDE.md

## This repository is the production marine pipeline for findr

Not `findr` itself. These workflows are the ones that actually feed fishfindr.eu:

| workflow | cron | writes |
| --- | --- | --- |
| FINDR Copernicus ingestion | `0 3,15` (360 min timeout) | `grid_conditions_latest`, tagged `copernicus-<REGION>` |
| FINDR MET Norway ingestion | `0 */6` | `findr_conditions_snapshots` |
| FINDR Open-Meteo ingestion | `30 2` | `findr_conditions_snapshots` |
| Ingest NOAA OISST | `15 */3` | global bulk SST |
| Ingest Chlorophyll / Kd490 | `30 */3`, `45 */3` | via the `ingest-conditions` edge function |
| Copernicus Data Freshness Check | `30 16` | — |
| Refresh Materialized Views | `*/30` | — |

The `ingest-conditions` edge function these call lives in `mrdamianrafferty/wotnow`, not here.
`src/lib/copernicus/` holds the routing; `scripts/ingestion/` the jobs.

## Before touching any feed — mandatory

Read `docs/2026-08-08-prediction-system.md` sections 8 and 9 **in the findr repository**. It is
the system of record for how these feeds fail. Each of the following has already cost a day:

- **A fetch that succeeds and returns null is indistinguishable from one that fails**, once
  stored. Both are a missing value. Four causes were proposed for one Kd490 coverage gap on
  2026-08-10 and all four were refuted, because each was reasoned from code and config rather
  than measured. One reached `main` as an inert change and was reverted (#67 → #68).
- **`regionRouterV2.ts` has no callers.** `realClient.ts` imports `regionRouter` (v1). Editing v2
  changes nothing at runtime — verify which module is actually imported before concluding a
  routing table is at fault.
- **Coverage percentages are cumulative, not current.** A null never overwrites a stored value,
  so "% of cells with Kd490" means *ever caught a clear day*, not *has a reading today*. That
  alone explained a 99% vs 43% split between regions with equivalent configuration.
- **Kd490 is a gappy daily satellite feed.** The same window swings 0%–95% valid by day. A few
  days of lag is normal and is not a defect.

## Required before proposing a cause

Measure it.

- To find **who** wrote a row: PostgREST publishes the caller's context as Postgres GUCs —
  `request.headers ->> 'x-client-info'` names the library, `->> 'x-forwarded-for'` the host,
  `request.method` distinguishes `.update()` (PATCH) from `.upsert()` (POST). Never store the
  full header JSON; it contains the Authorization bearer.
- To find whether a fetch **failed or returned nothing**: run it. A `workflow_dispatch`
  diagnostic against a handful of known cells, printing exit code and valid-pixel count, settles
  in minutes what inference gets wrong repeatedly.

## Required before changing a feed

- **Porting a script from findr?** Check this repo's `package.json` *and* lockfile first. A
  ported script imported `axios`, which is neither a dependency here nor in the lockfile, so
  `npm ci` would not install it and the job would have died at module load — looking like "the
  feature doesn't work". Node 20 has `fetch`, `AbortSignal.timeout` and web streams.
- **Adding a freshness or staleness threshold?** It must exceed the source's real latency.
  `collected_at` is the OBSERVATION time, not the fetch time.
- **Writing to `grid_conditions_latest`?** Several writers, no ordering between them. Never
  overwrite a fresher reading from another source.
- **Do not duplicate findr's ingestion.** Its two global workflows were retired 2026-08-10
  because both repos were hammering the same NOAA endpoint and both were being throttled off it.
  `findr`'s `ingest-europe` is the exception and must keep running: it is the only writer of the
  CMEMS marine columns into `findr_conditions_snapshots`, despite this repo having a script of
  the same filename that writes a different table.

## Before merging any pull request

**Read the reviews, not just the checks.** `gh pr checks` reporting "no checks reported on the
branch" means CI is not configured — it does not mean nobody has commented.

On 2026-08-11 six PRs were merged unread. Copilot had left eleven review comments across three of
them, and three were real defects in code already running in production: a retry loop that backed
off 35 seconds on a 404, a leaked connection per retry, and a `TextDecoder` that dropped
multi-byte characters split across chunk boundaries.

```bash
gh api "repos/{owner}/{repo}/pulls/N/reviews"  -q '.[] | .user.login+" ["+.state+"] "+(.body//"")'
gh api "repos/{owner}/{repo}/pulls/N/comments" -q '.[] | .path+":"+((.line//0)|tostring)+"  "+.body'
```

Both. `reviews` carries the summary verdict; `comments` carries the inline findings, and the
inline ones are where the defects are — a review can be `COMMENTED` with a clean-sounding summary
and still hold three bugs underneath.

**A review that contradicts your own commit message is a reason to check, not to argue.** One of
those eleven claimed the grid was 65,884 cells rather than 7,649. Measuring showed the reviewer
was wrong and the repo's own constant was stale — which meant the coverage step had been reporting
progress against a denominator 8.6× too large. Verifying the objection found a second bug.
