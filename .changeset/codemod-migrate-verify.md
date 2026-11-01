---
'@xstate/codemod': minor
---

`xstate-codemod migrate` accepts `--json`, which prints one JSON report to stdout. The command exits with code `2` when manual migration is needed, and the report lists each site under `manualSites` with its file, line, column, API, and hint.

A new report transform, `report-suffixed-lifecycle-events`, flags `on` keys written as `xstate.done.state.<id>`, `xstate.done.actor.<id>`, `xstate.error.actor.<id>`, or `xstate.after.<delay>.<id>`. v6 raises the plain event type with the id in a field, so those transitions never fire after migration. Another report transform, `report-action-shapes`, flags non-function `entry` and `exit` values and transition `actions`, which v6 rejects.

New `baseline` and `verify` commands check that a migrated machine behaves like the v5 original. `baseline` records a trace of generated event sequences under XState v5, and `verify` replays them against the v6 module and reports the diffs.

`baseline` and `verify` accept `--input <file>`, a JSON value passed as the machine's `input`.

```bash
npx @xstate/codemod baseline src/checkout.ts --out .xstate-migrate/checkout.json
npx @xstate/codemod migrate src/checkout.ts --json
# fix the reported manualSites
npx @xstate/codemod verify --baseline .xstate-migrate/checkout.json src/checkout.ts
```
