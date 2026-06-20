---
'xstate': major
---

Spawned actors, persistence, and machine-as-data fixes:

- `enq.spawn(logic, { id })` now registers the child on `snapshot.children` (and `enq.stop(ref)` removes it), so spawned actors are observable via `children` and survive persistence — matching invoked actors:

  ```ts
  entry: (_, enq) => {
    enq.spawn(childLogic, { id: 'child' });
  },
  on: {
    ping: ({ children }, enq) => {
      enq.sendTo(children.child, { type: 'PING' });
    }
  }
  ```

- Invoked actors registered by name keep their logical `src` (e.g. `'fetchUser'`) in persisted snapshots instead of a positional id, and rehydrated children are started again on `actor.start()`.

- Machines are serializable again: `serializeMachine(machine)` returns the JSON-safe definition (and `machineConfigToJSON(config)` does the same for a raw machine config). Inline functions, actor logic, and runtime schemas appear as explicit `{ "$unserializable": ... }` markers. `createMachineFromConfig(json)` is also exported from `xstate` and round-trips losslessly with `serializeMachine`:

  ```ts
  import { createMachineFromConfig, serializeMachine } from 'xstate';

  const revived = createMachineFromConfig(
    JSON.parse(JSON.stringify(serializeMachine(machine)))
  );
  ```

- Type fixes: context inferred from a literal initial value is widened (`context: { count: 0 }` infers `{ count: number }`, so context updates typecheck); `invoke.input` accepts a static value (not just a function); `onDone` exposes `event.output`. The v6 config types are exported: `MachineConfig`, `StateNodeConfig`, `InvokeConfig`, `TransitionConfigOrTarget`, `MachineJSON`, plus the type utilities `InferEvents`, `WidenLiterals`, and `Implementations`.
