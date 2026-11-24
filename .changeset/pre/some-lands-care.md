---
'xstate': minor
---

Keep model traversal paths distinct when state inputs or remembered history differ, and fix published declarations for consumers using exact optional properties with library checking enabled.

Directed graphs now include static eventless transitions and report function-based destinations that cannot be extracted. The experimental `getMachineSerializationDiagnostics(machine)` helper identifies values that need runtime bindings or cannot be preserved by machine JSON, including omitted `undefined` object properties and array entries.

Add JSON CLI commands for version-matched documentation, inspection, definition validation, effect-free simulation, bounded state assertions, counterexample replay, and structural diffs. Run `npx xstate docs --json` to find the installed agent guide and API stability manifest. The data-only CLI refuses code expressions and does not execute external effects or claim formal proofs.
