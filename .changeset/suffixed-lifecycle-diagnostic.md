---
'xstate': patch
---

In development builds, `createMachine` throws when an `on` key is a v5 suffixed lifecycle event type such as `'xstate.done.actor.job'`, `'xstate.error.actor.job'`, `'xstate.done.state.form'` or `'xstate.after.1000.loading'`. v6 never sends these types, so the transition never fired. The error names the replacement:

```ts
// Throws: Transition "xstate.done.actor.job" in state "loading" never fires ...
on: { 'xstate.done.actor.job': { target: 'done' } }

// Use the category type and select the child with `matches`
on: { 'xstate.done.actor': { matches: { actorId: 'job' }, target: 'done' } }
```

Wildcards such as `'xstate.done.actor.*'` and the `'xstate.snapshot.actor'` type are unaffected.
