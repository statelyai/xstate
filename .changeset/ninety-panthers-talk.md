---
'xstate': patch
---

Fixed an issue with spawned actors being spawned multiple times when they got spawned in an initial state of a child machine that is invoked in the initial state of a parent machine.

<details>
<summary>
Illustrating example for curious readers.
</summary>

```js
const child = createMachine({
  initial: 'bar',
  context: {},
  states: {
    bar: {
      entry: assign({
        promise: () => {
          return spawn(() => Promise.resolve('answer'));
        }
      })
    }
  }
});

const parent = createMachine({
  initial: 'foo',
  states: {
    foo: {
      invoke: {
        src: child,
        onDone: 'end'
      }
    },
    end: { type: 'final' }
  }
});

interpret(parent).start();
```

</details>
