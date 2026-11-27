---
'xstate': minor
'@xstate/test': patch
---

Add a `generate` option to `xstate test` to sample event payloads and one startup input from JSON Schemas embedded in a machine definition. Set a seed to reproduce sampling or supply explicit cases for individual event types.

Effect Schema string generators honor Unicode code point bounds. Generators report an error when a refinement rejects 1,000 consecutive candidates.
