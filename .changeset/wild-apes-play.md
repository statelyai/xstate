---
'xstate': major
---

`exit` actions of all states are no longer called when the machine gets stopped externally. Note that they are still called when the machine reaches its final state.
