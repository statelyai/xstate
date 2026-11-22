---
"xstate": patch
---

Select event transitions from each active leaf in parallel states, matching `always`. A shared ancestor's targetless handler can now run alongside a region's handler for the same event. If only specific regions should run the ancestor handler, move it into those regions.
