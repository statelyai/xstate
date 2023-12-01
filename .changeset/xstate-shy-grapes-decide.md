---
'xstate': minor
---

The new `enqueueActions(...)` action creator can now be used to enqueue actions to be executed. This is a helpful alternative to the `pure(...)` and `choose(...)` action creators.

```ts
const machine = createMachine({
  // ...
  entry: enqueueActions(({ context, event, enqueue, check }) => {
    // assign action
    enqueue.assign({
      count: context.count + 1
    });

    // Conditional actions (replaces choose(...))
    if (event.someOption) {
      enqueue.sendTo('someActor', { type: 'blah', thing: context.thing });

      // other actions
      enqueue('namedAction');
      // with params
      enqueue({ type: 'greet', params: { message: 'hello' } });
    } else {
      // inline
      enqueue(() => console.log('hello'));

      // even built-in actions
    }

    // Use check(...) to conditionally enqueue actions based on a guard
    if (check({ type: 'someGuard' })) {
      // ...
    }

    // no return
  })
});
```
