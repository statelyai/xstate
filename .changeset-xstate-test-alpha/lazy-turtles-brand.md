---
'@xstate/test': major
---

pr: #3036
author: @mattpocock

Moved event cases out of `events`, and into their own attribute called `eventCases`:

```ts
const model = createTestModel(machine, {
  eventCases: {
    CHOOSE_CURRENCY: [
      {
        currency: 'GBP'
      },
      {
        currency: 'USD'
      }
    ]
  }
});

model.getPaths().forEach((path) => {
  it(path.description, async () => {
    await path.test({
      events: {
        CHOOSE_CURRENCY: ({ event }) => {
          console.log(event.currency);
        }
      }
    });
  });
});
```

`eventCases` will also now always produce a new path, instead of only creating a path for the first case which matches.
