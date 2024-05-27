---
'@xstate/graph': major
---

Path generation now supports `input` for actor logic:

```ts
const model = createTestModel(
  setup({
    types: {
      input: {} as {
        name: string;
      },
      context: {} as {
        name: string;
      }
    }
  }).createMachine({
    context: (x) => ({
      name: x.input.name
    }),
    initial: 'checking',
    states: {
      checking: {
        always: [
          { guard: (x) => x.context.name.length > 3, target: 'longName' },
          { target: 'shortName' }
        ]
      },
      longName: {},
      shortName: {}
    }
  })
);

const path1 = model.getShortestPaths({
  input: { name: 'ed' }
});

expect(path1[0].steps.map((s) => s.state.value)).toEqual(['shortName']);

const path2 = model.getShortestPaths({
  input: { name: 'edward' }
});

expect(path2[0].steps.map((s) => s.state.value)).toEqual(['longName']);
```
