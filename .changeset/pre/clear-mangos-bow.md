---
"xstate": patch
---

Select event transitions from each active leaf in parallel states, matching `always`. A shared ancestor transition can now run alongside a region transition for the same event if they exit no states in common. For example, the ancestor can exit the parallel state while a region runs a targetless handler. To restrict where an event handler is selected, define it in the regions that should handle it.

Check active leaves in definition order for both event and `always` transitions. Changing the active leaf in a region no longer changes which region has priority when their transitions conflict.
