---
'@xstate/store': patch
---

The `createStore` function now supports explicit generic type parameters for better type control when needed. This allows you to specify the exact types for context, events, and emitted events instead of relying solely on type inference if desired.

```ts
type CoffeeContext = {
  beans: number;
  cups: number;
};

type CoffeeEvents = { type: 'addBeans'; amount: number } | { type: 'brewCup' };

type CoffeeEmitted =
  | { type: 'beansAdded'; amount: number }
  | { type: 'cupBrewed' };

const coffeeStore = createStore<CoffeeContext, CoffeeEvents, CoffeeEmitted>({
  context: {
    beans: 0,
    cups: 0
  },
  on: {
    addBeans: (ctx, event, enq) => {
      enq.emit.beansAdded({ amount: event.amount });
      return { ...ctx, beans: ctx.beans + event.amount };
    },
    brewCup: (ctx, _, enq) => {
      if (ctx.beans > 0) {
        enq.emit.cupBrewed();
        return { ...ctx, beans: ctx.beans - 1, cups: ctx.cups + 1 };
      }

      return ctx;
    }
  }
});
```
