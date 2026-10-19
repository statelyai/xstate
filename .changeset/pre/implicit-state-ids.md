---
'xstate': major
---

Implicit state and invoke ids no longer use the `(machine)` placeholder.

- A state's implicit id is its path from the root joined by `.`, prefixed by the machine `id` when there is one: `shop.checkout.payment` for `id: 'shop'`, and `checkout.payment` without an id (previously `(machine).checkout.payment`).
- `machine.id` and the root state's id are `''` for a machine without an `id`. `#` cannot reference that root; give the machine an `id` to target it as `#shop`.
- An unnamed invoke's id is `<stateId>:<index>`: `loading:0`, `loading:1`, `shop.checkout:0`. A root invoke is `:0`, or `shop:0` with a machine id (previously `0.(machine).loading`). Anonymous spawned actors keep `x:<n>`, and generated spawn ids skip ids already held by an invoke.
- An explicit state `id` that equals another state's id throws when the machine is created.
- Error messages name `the machine` instead of `machine '(machine)'`.

```ts
const machine = createMachine({
  initial: 'loading',
  states: { loading: { invoke: { src: fetchUser } } }
});

createActor(machine).getSnapshot().children; // { 'loading:0': ... }
machine.getStateNodeById('#loading').id; // 'loading'
```

Persisted snapshots that reference `(machine).…` state ids or `0.(machine).…` child ids do not restore; migrate them with `machineVersions`.
