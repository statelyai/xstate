---
'@xstate/codemod': minor
---

`xstate-codemod migrate` accepts `--json`, which prints one JSON report to stdout. The command exits with code `2` when manual migration is needed, and the report lists each site under `manualSites` with its file, line, column, API, and hint.

New `baseline` and `verify` commands check that a migrated machine behaves like the v5 original. `baseline` records a trace of generated event sequences under XState v5, and `verify` replays them against the v6 module and reports the diffs.

```bash
npx @xstate/codemod baseline src/checkout.ts --out .xstate-migrate/checkout.json
npx @xstate/codemod migrate src/checkout.ts --json
# fix the reported manualSites
npx @xstate/codemod verify --baseline .xstate-migrate/checkout.json src/checkout.ts
```
