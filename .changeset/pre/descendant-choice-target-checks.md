---
'xstate': patch
---

Check ancestor context refinements when a transition targets a descendant, including declared `#id` targets, target arrays, and sibling-relative targets inside a refined parent. Require a compatible context patch when the source does not satisfy those refinements.

Preserve literal targets returned by choice functions so unknown static targets are TypeScript errors in `createMachine` and `setup().createMachine`. Computed `string` targets remain supported.
