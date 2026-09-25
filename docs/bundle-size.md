# Bundle measurements

<!-- commands and behavior from package.json scripts, scripts/bundle-size.mjs, scripts/bundle-size-verify.mjs, scripts/bundle-size.targets.json, scripts/bundle-size.thresholds.json, and .github/actions/ci-checks/action.yml -->

`pnpm bench:size` bundles representative XState, store, and adapter entry points
from source. It reports esbuild and Terser minified and gzipped sizes, then checks
the esbuild gzip results against `scripts/bundle-size.thresholds.json`.

Useful diagnostics:

```bash
pnpm bench:size --profile=minimal-machine # Measure one profile
pnpm bench:size --why                    # Attribute bytes to modules
pnpm bench:size --verify                 # Execute both minified outputs
pnpm bench:size --json                   # Emit machine-readable results
pnpm bench:size --report                 # Report without enforcing thresholds
pnpm build
pnpm bench:size --dist                   # Inspect the latest production build
```

Add `--baseline=<commit>` to compare the current profiles with source at that
commit. CI runs the default threshold check. A threshold is the regression line
and fails when exceeded; a target in `scripts/bundle-size.targets.json` is an
informational goal and does not fail the run.

When a source-size increase is intentional, run `pnpm bench:size:update`, review
every changed exact gzip limit, and commit the updated threshold file. Updating
refuses to raise a threshold above its target; use
`pnpm bench:size:update --force` only when the reviewed increase is intentional.
