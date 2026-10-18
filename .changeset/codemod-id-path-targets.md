---
'@xstate/codemod': minor
---

Added the `report-id-path-targets` transform. It reports, without rewriting, `#a.b` targets and `matches('#a.b')` or `stateIn('#a.b')` arguments that are not whole state ids declared in the same file, since v6 resolves `#` targets by exact id only.

```ts
// Reported: `flow` is an explicit id, and `flow.review` is not an id
on: { review: { target: '#flow.review' } }
// Not reported: the full implicit id
on: { review: { target: '#shop.wizard.review' } }
```
