---
'xstate': patch
---

Fixed declaration emit for machines and setups created with `setup({ states })`.
A package that exported one could not be built with `declaration: true`: the
emitted types reached for `ActiveStateContext` and a handful of private marker
types that were never exported from the package entry point, so consumers saw
TS2742 ("cannot be named without a reference to xstate/dist/...") or TS4023 on
xstate's internal `unique symbol`s.

The types declaration emit needs are now public — `ActiveStateContext`,
`RootContextMarker`, `ChoiceStateNodeConfig`, `RegularStateNodeConfig`, and the
strict-target markers — and the private state-schema symbols live behind named
marker types instead of inline computed keys, so emit references a name rather
than expanding a symbol it cannot write down.
