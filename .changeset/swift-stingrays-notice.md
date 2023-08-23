---
'xstate': minor
---

Output types can now be specified in the machine:

```ts
const machine = createMachine({
  types: {} as {
    output: {
      result: 'pass' | 'fail';
      score: number;
    };
  }
  // ...
});

const actor = createActor(machine);

// ...

const snapshot = actor.getSnapshot();

if (snapshot.output) {
  snapshot.output.result;
  // strongly typed as 'pass' | 'fail'
  snapshot.output.score;
  // strongly typed as number
}
```
