---
'xstate': major
---

Actors are now always part of a "system", which is a collection of actors that can communicate with each other. Systems are implicitly created, and can be used to get and set references to any actor in the system via the `key` prop:

```js
const machine = createMachine({
  // ...
  invoke: {
    src: emailMachine,
    // Registers `emailMachine` as `emailer` on the system
    key: 'emailer'
  }
});
```

```js
const machine = createMachine({
  // ...
  entry: assign({
    emailer: (ctx, ev, { spawn }) => spawn(emailMachine, { key: 'emailer' })
  })
});
```

Any invoked/spawned actor that is part of a system will be able to reference that actor:

```js
const anotherMachine = createMachine({
  // ...
  entry: sendTo(
    (ctx, ev, { system }) => {
      return system.get('emailer');
    },
    { type: 'SEND_EMAIL', subject: 'Hello', body: 'World' }
  )
});
```

Each top-level `interpret(...)` call creates a separate implicit system. In this example example, `actor1` and `actor2` are part of different systems and are unrelated:

```js
// Implicit system
const actor1 = interpret(machine).start();

// Another implicit system
const actor2 = interpret(machine).start();
```
