# @xstate/store-angular

Angular adapter for [@xstate/store](https://stately.ai/docs/xstate-store).

## Installation

```bash
npm install @xstate/store-angular
```

## Quickstart

```ts
import { Component } from '@angular/core';
import { createStore, injectStore } from '@xstate/store-angular';
// ...

const store = createStore({
  context: { count: 0 },
  on: {
    inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
  }
});

@Component({
  selector: 'app-counter',
  template: `
    <button (click)="store.send({ type: 'inc' })">Count: {{ count() }}</button>
  `
})
export class CounterComponent {
  store = store;
  count = injectStore(store, (s) => s.context.count);
}
```

## API

### `injectStore(store, selector?, options?)`

An Angular function that creates a signal subscribed to a store, selecting a value via an optional selector function.

```ts
import { Component } from '@angular/core';
import { createStore, injectStore } from '@xstate/store-angular';
// ...

const store = createStore({
  context: { count: 0 },
  on: {
    inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
  }
});

@Component({
  selector: 'app-counter',
  template: `<div>{{ count() }}</div>`
})
export class CounterComponent {
  count = injectStore(store, (s) => s.context.count);
  // or without selector (returns full snapshot)
  snapshot = injectStore(store);
}
```

**Arguments:**

- `store` - Store created with `createStore()`
- `selector?` - Function to select a value from snapshot
- `options?` - Signal creation options with optional `equal` function and `injector`

**Returns:** Readonly Angular signal of the selected value

---

## Re-exports

All exports from `@xstate/store` are re-exported, including `createStore`, `createStoreWithProducer`, `createAtom`, and more.

See the [XState Store docs](https://stately.ai/docs/xstate-store) for the full API, and the [Angular-specific docs](https://stately.ai/docs/xstate-store#angular) for more Angular examples.
