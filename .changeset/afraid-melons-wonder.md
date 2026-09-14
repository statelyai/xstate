---
'xstate': patch
---

`AnyStateNode` and `AnyStateNodeDefinition` now widen the `TStateMeta` and `TTransitionMeta` parameters that were added to `StateNode` and `StateNodeDefinition` in 5.33.0. Those parameters default to `MetaObject`, while the nodes of an `AnyStateMachine` have them as `any`, so tooling that tracks `any` (such as `@typescript-eslint`'s `no-unsafe-argument` and `no-unsafe-return`) reported every node read off an untyped machine as unsafe:

```ts
declare const machine: AnyStateMachine;

// StateNode<any, any, any, any> passed to StateNode<any, any, MetaObject, MetaObject>
takesStateNode(machine.root);
```

`AnyTransitionDefinition` was widened along with the new parameters; these two were missed.
