---
'@xstate/react': patch
---

Fix an issue where `after` transitions do not work in React strict mode. Delayed events (including from `after` transitions) should now work as expected in all React modes.
