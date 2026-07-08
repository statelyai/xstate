---
'xstate': major
---

Add `createSystem({ registry })` for declaring typed actor registry keys and creating actors in that system.

Registry keys are assigned with `registryKey` on invokes, spawned actors, and root actors created from the system. Registry keys are checked against the declared registry when using `createSystem`. Transition functions also receive the typed `system`, so registry actors can be looked up without casting.

Actor logic source maps are now declared with `actorSources` and referenced by `invoke.src`, `spawnChild`, and `enqueueActions` helpers. The old `actors` setup/provide key has been removed.

```ts
const system = createSystem({
  registry: {
    receiver: receiverLogic
  }
});

const machine = system
  .setup({
    actorSources: {
      receiver: receiverLogic
    }
  })
  .createMachine({
    invoke: {
      src: 'receiver',
      registryKey: 'receiver'
    },
    on: {
      ping: ({ system }, enq) => {
        enq.sendTo(system.get('receiver'), { type: 'HELLO' });
      }
    }
  });

const actor = system.createActor(machine).start();

system.get('receiver')?.send({ type: 'HELLO' });
```
