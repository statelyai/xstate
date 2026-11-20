---
'@xstate/test': minor
---

Add a SUT session `receive({ signal })` hook for live model-based tests. Let an observed event advance the model and determine which inputs the test can send next. Replay fixtures check the recorded output and report when the SUT takes a different legal branch.
