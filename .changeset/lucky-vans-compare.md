---
'xstate': major
---

The history resolution algorithm has been refactored to closely match the SCXML algorithm, which simplifies the code and eliminates the `state.historyValue` prop in lieu of a `state.historyMap` prop, which maps history state nodes to their currently resolved target IDs.
