# Bundle measurements

<!-- commands and behavior from package.json scripts, scripts/bundle-size.mjs, scripts/bundle-size-verify.mjs, scripts/bundle-size.thresholds.json, and .github/actions/ci-checks/action.yml -->

`pnpm bench:size` bundles representative XState, store, and adapter entry points
from source. It reports esbuild and Terser minified and gzipped sizes, then checks
the esbuild gzip results against `scripts/bundle-size.thresholds.json`.

Useful diagnostics:

```bash
pnpm bench:size --profile=minimal-machine # Measure one profile
pnpm bench:size --why                    # Attribute bytes to modules
pnpm bench:size --verify                 # Execute both minified outputs
pnpm bench:size --json                   # Emit machine-readable results
pnpm build
pnpm bench:size --dist                   # Inspect the latest production build
```

`--report` skips threshold enforcement. Add `--baseline=<commit>` to compare the
current profiles with source at that commit. Bundle measurement is not part of
the current CI action, so run the relevant command locally before submitting a
size-sensitive change.

When a source-size increase is intentional, run `pnpm bench:size:update`, review
every changed exact gzip limit, and commit the updated threshold file.
