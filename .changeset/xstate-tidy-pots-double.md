---
'xstate': major
---

All transitions became internal by default. The style of the `target` pattern (`.child`, `sibling`, `#id`) has now no effect on the transition type.

Internal transitions don't reenter their source state when the target lies within it. You can still create external transitions (ones that reenter the source state under the mentioned circumstances) by explicitly setting `external: true` on the given transition.
