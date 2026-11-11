# Eventless transitions measurements

These measurements compare `xstate/fsm` with eventless transitions and object-only transition targets against
integration commit `da64b0aa177a40501f488612296f527a4f8b46ab`, before the feature.
Raw samples, environment details, and the feature source hash are retained
with the results.

## Bundle size

<!-- measurements from benchmarks/fsm-always/size.json, produced by measure.mjs -->

| Bundle | Minifier | Baseline | Updated FSM | Added | Gzip baseline | Gzip updated FSM | Gzip added |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Full FSM entry | Terser | 807 | 1390 | 583 | 468 | 728 | 260 |
| Full FSM entry | esbuild | 812 | 1395 | 583 | 478 | 748 | 270 |
| Toggle app | Terser | 790 | 1373 | 583 | 454 | 708 | 254 |
| Toggle app | esbuild | 798 | 1381 | 583 | 463 | 725 | 262 |

All values are bytes. The full entry includes `createFSM`, `setup`, and
`types`. The toggle application does not declare `always`, so its increase
measures the bundle cost paid by an existing consumer. Both variants use
browser ESM, an ES2022 target, identical minifier settings, and pako gzip
level 9. Source and type declaration sizes are excluded.

## Runtime without always

<!-- measurements from benchmarks/fsm-always/runtime-summary.json -->

CPU nanoseconds per operation, median (minimum to maximum), nine paired
samples per variant. Percentage changes are medians and ranges of paired
CPU-cost ratios, not ratios of the two unpaired medians. Positive means
slower. No actors or subscribers are included.

| Runtime | Operation | Baseline CPU ns | Updated FSM CPU ns | Paired CPU change |
| --- | --- | ---: | ---: | ---: |
| Node | toggle | 95.6 (92.6 to 108.0) | 97.6 (95.3 to 112.4) | +2.9% (-3.2% to +15.3%) |
| Node | counter | 179.2 (155.0 to 208.7) | 177.4 (160.8 to 195.1) | -2.6% (-14.7% to +15.6%) |
| Node | ignored | 84.9 (76.8 to 91.0) | 33.1 (29.9 to 38.2) | -61.4% (-65.4% to -50.3%) |
| Node | construction | 28.8 (26.3 to 32.3) | 85.8 (79.9 to 92.4) | +208.1% (+182.3% to +216.8%) |
| Bun | toggle | 44.0 (42.7 to 45.1) | 47.6 (47.2 to 49.2) | +10.2% (+5.3% to +12.7%) |
| Bun | counter | 106.0 (104.7 to 110.6) | 108.3 (105.0 to 110.1) | +2.3% (-5.1% to +3.9%) |
| Bun | ignored | 41.2 (40.9 to 42.4) | 32.6 (32.0 to 33.0) | -21.4% (-23.8% to -19.7%) |
| Bun | construction | 31.8 (30.8 to 34.9) | 67.3 (65.6 to 69.7) | +107.7% (+88.2% to +118.9%) |

Both variants use identical object-target configurations. The updated FSM
includes eventless transitions and rejection of bare string transitions.
Small differences whose paired ranges include zero are inconclusive.
Ignored events bypass patch processing. Construction pays for scanning all
own state and event definitions to validate strings and detect `always`.
This scan runs once per `createFSM`, not per event or per `createActor`.
Machines without `always` bypass settlement during initialization and after events.


Both sources are bundled and minified with identical esbuild settings, ESM
format, and ES2022 target. Each case runs in a fresh process; variants
alternate order across nine rounds. Each sample gets 200 ms warmup, at
least 400 ms wall time and 150 ms process CPU time, with a five-second cap.
Each case also receives an initial warmup. Every saved sample met the CPU
budget. State, counter totals, no-op snapshot identity, and constructed
machine shape are verified outside the timed loop.

These runs used Node 26.11.1 and Bun 1.3.0 on macOS arm64. The host was
running unrelated work. Runtime versions, CPU model, load averages, wall
time, paired wall-time changes, and raw samples are retained in the JSON
files. CPU time includes runtime helper threads and is not application
latency. These are synchronous microbenchmarks.

Separate Node diagnostic profiles inspect transition lookup, patch
processing, validation, allocation, and GC. Profiling runs use an
unminified build and do not contribute to the timing results.

## Reproduction

<!-- commands for benchmarks/fsm-always/measure.mjs, runtime.mjs, and summarize-runtime.py -->

Run from the repository root after installing dependencies with pnpm:

```sh
node benchmarks/fsm-always/measure.mjs
NODE_ENV=production node benchmarks/fsm-always/runtime.mjs
NODE_ENV=production bun benchmarks/fsm-always/runtime.mjs
python3 benchmarks/fsm-always/summarize-runtime.py
pnpm exec oxfmt --write benchmarks/fsm-always/*.json
```

Optional diagnostic profiles, after building with `runtime.mjs`:

```sh
for subject in toggle construction; do
  for variant in base feature; do
    node --cpu-prof --cpu-prof-interval=100 --cpu-prof-dir=benchmarks/fsm-always/.runtime --cpu-prof-name="$subject-$variant.cpuprofile" benchmarks/fsm-always/runtime.mjs "$subject" "$variant" profile
  done
done
```

Compiled variants and profiles are written under the ignored `.runtime`
directory. Set `CASES`, `ROUNDS`, `SAMPLE_MS`, and `RESULTS_DIR` for exploratory
runs without replacing the saved measurements. Runtime measurements apply
to the `featureSha256` recorded in each raw result file. Re-running the
measurement commands replaces the corresponding result files.
