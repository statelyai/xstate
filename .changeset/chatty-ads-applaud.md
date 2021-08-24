---
"xstate": patch
---

Widened the *From utility types to allow extracting from factory functions.

This allows for:

```ts
const makeMachine = () => createMachine({});

type Interpreter = InterpreterFrom<typeof makeMachine>;
type Actor = ActorRefFrom<typeof makeMachine>;
type Context = ContextFrom<typeof makeMachine>;
type Event = EventsFrom<typeof makeMachine>;
```

This also works for models, behaviours, and other actor types.

The previous method for doing this was a good bit uglier:

```ts
const makeMachine = () => createMachine({});

type Interpreter = InterpreterFrom<ReturnType<typeof machine>>;
```
