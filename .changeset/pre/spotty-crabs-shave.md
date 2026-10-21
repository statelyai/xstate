---
'xstate': patch
---

Importing only `xstate/fsm` now typechecks on its own. Previously, an fsm-only program failed with `Property 'observable' does not exist on type 'SymbolConstructor'` errors because the `Symbol.observable` type augmentation lived in the main entry. The `xstate/fsm` entry also no longer pulls the main entry's full type surface into the program, so editors and `tsc` check far less code for fsm-only consumers.
