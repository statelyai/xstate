---
'xstate': patch
---

State IDs that have periods in them are now supported if those periods are escaped.

The motivation is that external tools, such as [Stately Studio](https://stately.ai/studio), may allow users to enter any text into the state ID field. This change allows those tools to escape periods in state IDs, so that they don't conflict with the internal path-based state IDs.

E.g. if a state ID of `"Loading..."` is entered into the state ID field, instead of crashing either the external tool and/or the XState state machine, it should be converted by the tool to `"Loading\\.\\.\\."`, and those periods will be ignored by XState.
