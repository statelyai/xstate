---
"xstate": patch
---

fix(core): fall back to wildcard event descriptors when an exact descriptor's guard fails

When a state has both an exact event descriptor (e.g. `"foo.bar"`) and a matching wildcard descriptor (e.g. `"foo.*"`), transitions from the exact descriptor are now tried first; if all their guards fail, matching wildcard descriptor transitions are tried as fallback. Previously, the presence of an exact match would prevent any wildcard fallback from being considered, leaving the machine in its current state when the exact descriptor's guard failed.
