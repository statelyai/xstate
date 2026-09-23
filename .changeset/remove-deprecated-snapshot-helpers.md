---
'xstate': minor
---

### Removed

- `getInitialSnapshot(logic, input?)` and `getNextSnapshot(logic, snapshot, event)`. Use `initialTransition(...)` and `transition(...)`, which return `[snapshot, effects]`.
- The deprecated type aliases `NoInfer` (use the built-in `NoInfer`), `AnyInterpreter` (use `AnyActor`), and `ResolvedStateMachineTypes`.

```ts
import { initialTransition, transition } from 'xstate';

const [initial] = initialTransition(machine, input);
const [next] = transition(machine, initial, { type: 'NEXT' });
```
