---
'xstate': major
---

`#` targets, `snapshot.matches('#…')` and `@xstate.stateIn` guards resolve by exact state id. The text after `#` is a state's whole id, either its explicit `id` or its implicit id (the path from the root, prefixed by the machine `id`). It is no longer split into an id followed by a relative path. Dots in explicit ids are matched as written, without escaping.

```ts
// `wizard` has `id: 'flow'` in a machine with `id: 'shop'`

// Before
browsing: { on: { review: { target: '#flow.review' } } }

// After: the target's full implicit id, or give it its own `id`
browsing: { on: { review: { target: '#shop.wizard.review' } } }
```

An unknown id throws when the machine is created. When the old id-plus-path form resolves, the error names the target's id:

```
No state has id "flow.review". Use "#shop.wizard.review", or give that state an id.
```

Typed `#` targets and `matches('#…')` accept only whole ids.
