---
'xstate': major
---

The history resolution algorithm has been refactored to closely match the SCXML algorithm, which simplifies the code and changes the shape of `state.historyValue`to map history state nodes to their currently resolved target IDs.
