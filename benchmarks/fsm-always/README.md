# Eventless transitions measurements

These measurements compare `xstate/fsm` with eventless transitions against
integration commit `da64b0aa177a40501f488612296f527a4f8b46ab`, before the feature.
Raw samples, environment details, and the feature source hash are retained
with the results.

## Bundle size

<!-- measurements from benchmarks/fsm-always/size.json, produced by measure.mjs -->

| Bundle | Minifier | Baseline | With always | Added | Gzip baseline | Gzip with always | Gzip added |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Full FSM entry | Terser | 807 | 1133 | 326 | 468 | 609 | 141 |
| Full FSM entry | esbuild | 812 | 1138 | 326 | 478 | 622 | 144 |
| Toggle app | Terser | 772 | 1098 | 326 | 449 | 583 | 134 |
| Toggle app | esbuild | 780 | 1106 | 326 | 459 | 595 | 136 |

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

| Runtime | Operation | Baseline CPU ns | With always support CPU ns | Paired CPU change |
| --- | --- | ---: | ---: | ---: |
| Node | toggle | 94.6 (93.9 to 96.1) | 99.5 (96.7 to 101.7) | +4.8% (+1.9% to +8.1%) |
| Node | counter | 153.4 (147.0 to 160.4) | 153.2 (150.8 to 177.3) | +2.5% (-4.9% to +10.5%) |
| Node | ignored | 67.2 (66.8 to 68.4) | 27.4 (27.0 to 28.0) | -59.3% (-60.1% to -58.3%) |
| Node | construction | 28.3 (26.1 to 30.3) | 58.0 (54.9 to 73.3) | +104.6% (+99.8% to +141.8%) |
| Bun | toggle | 45.9 (44.7 to 46.8) | 46.0 (45.4 to 46.9) | +0.5% (-1.4% to +2.7%) |
| Bun | counter | 106.2 (104.4 to 110.7) | 106.8 (106.1 to 109.8) | +1.3% (-2.7% to +5.2%) |
| Bun | ignored | 40.4 (40.0 to 42.1) | 31.6 (30.8 to 33.9) | -21.9% (-23.6% to -17.1%) |
| Bun | construction | 31.5 (28.5 to 36.7) | 49.0 (46.1 to 58.4) | +57.9% (+51.2% to +65.2%) |

Node retains about 5 ns of toggle overhead. Bun toggle and both counter
comparisons have paired ranges that include zero change; their small
median differences are inconclusive. Ignored events return before the
baseline's empty patch-copy and key-enumeration work.

A scan for `always` declarations runs once per `createFSM`, not per event
or per `createActor`. Machines without `always` bypass initialization
settlement and the settlement loop after events. Construction remains
more expensive: about 58 ns on Node and 49 ns on Bun for the two-state
fixture. The feature trades setup cost for lower event-processing overhead.

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

Separate Node diagnostic profiles identify transition lookup, patch
processing, allocation, and GC as the measured work. Profiling runs use an
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
