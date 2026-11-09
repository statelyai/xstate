---
'xstate': major
---

The serialized actor reference key is renamed from `$actor` to `@actor`. This affects persisted snapshots, `systemTransition` snapshots, `describeExecutableEffect` descriptors, `sendTo` targets and dead letters.

```ts
// Before
{ $actor: 'order/worker', incarnation: 'a:1' }
// After
{ '@actor': 'order/worker', incarnation: 'a:1' }
```

Stores such as Convex and MongoDB reject field names that start with `$`, so the old shape could not be stored without rewriting it. Snapshots written by `6.0.0-beta.1` that contain `$actor` are not revived as actor references.
