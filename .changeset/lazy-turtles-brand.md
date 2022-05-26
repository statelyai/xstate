---
'@xstate/test': major
---

@author: @mattpocock

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
```
