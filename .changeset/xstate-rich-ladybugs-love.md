---
'xstate': major
---

Changed behavior of `always` transitions. Previously they were always selected after selecting any transition (including the `always` transitions). Because of that it was relatively easy to create an infinite loop using them.

Now they are no longer selected if the preceeding transition doesn't change the state of a machine.
