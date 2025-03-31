---
'@xstate/store': patch
---

Fix type inference for discriminated union event types in the `trigger` object. Previously, using `Omit` with union types would incorrectly combine event types, breaking type inference for discriminated unions. This has been fixed by introducing a `DistributiveOmit` type that correctly preserves the relationship between discriminated properties.
