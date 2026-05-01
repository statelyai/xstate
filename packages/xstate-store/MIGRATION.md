# @xstate/store v4 Migration Guide

## New features

### `createAsyncStore`

`createAsyncStore` creates stores with async transition handlers. Use `enq.step(stepId, exec)` for resumable async steps — each step's status is tracked in `snapshot.async`.

```ts
const store = createAsyncStore({
  context: {
    result: undefined as number | undefined
  },
  schemas: {
    emitted: {
      loaded: schema<{ result: number }>()
    }
  },
  on: {
    load: async (_ctx, _event, enq) => {
      enq.effect(() => {
        console.log('before');
      });

      const result = await enq.step('fetchResult', async () => 42);

      enq.effect(() => {
        console.log('after');
      });
      enq.emit.loaded({ result });

      return { result };
    }
  }
});

store.on('loaded', (ev) => console.log(ev.result));
store.trigger.load();

// Immediately after: step is tracked as active
store.getSnapshot().async;
// => { "<id>": { event: { type: "load" }, steps: { async: { status: "active" }, fetchResult: { status: "active" } } } }

// After resolution: async state is cleaned up
// => {}
store.getSnapshot().context.result; // => 42
```

Sequential async steps are replayed one at a time:

```ts
const store = createAsyncStore({
  context: { result: 0 },
  on: {
    load: async (ctx, _event, enq) => {
      const first = await enq.step('first', () => fetchFirst());
      const second = await enq.step('second', () => fetchSecond());
      return { result: ctx.result + first + second };
    }
  }
});

store.trigger.load();
// steps.first: { status: "active" }
// After first resolves → steps.first: { status: "done", output: 2 }, steps.second: { status: "active" }
// After second resolves → async cleared, context.result === 5
```

### Standard Schema support

Store configs now accept a `schemas` property for deriving types from any [Standard Schema](https://github.com/standard-schema/standard-schema)-compatible library (Zod, Valibot, ArkType, etc.) instead of manual type annotations.

**Context schema** — types the snapshot context:

```ts
const store = createStore({
  schemas: {
    context: schema<{ count: number; label: string }>()
  },
  context: { count: 0, label: 'ready' },
  on: {
    rename: (ctx, ev: { label: string }) => ({
      ...ctx,
      label: ev.label
    })
  }
});

store.getSnapshot().context.label; // typed as string
```

**Event schemas** — types events from schemas instead of inline annotations:

```ts
const store = createStore({
  schemas: {
    events: {
      log: schema<
        { level: 'warn'; message: string } | { level: 'error'; error: string }
      >()
    }
  },
  context: {},
  on: {}
});

store.trigger.log({ level: 'warn', message: 'hmm' }); // ok
store.trigger.log({ level: 'error', error: 'uh oh' }); // ok
store.trigger.log({ level: 'error', message: 'foo' }); // type error
```

**Emitted schemas** — see [emits → schemas.emitted](#emits-config-property) below.

**Works with `fromStore` too:**

```ts
const logic = fromStore({
  context: (count: number) => ({ count }),
  schemas: {
    emitted: {
      increased: schema<{ upBy: number }>()
    }
  },
  on: {
    inc: (ctx, ev: { by: number }, enq) => {
      enq.emit.increased({ upBy: ev.by });
      return { count: ctx.count + ev.by };
    }
  }
});

const actor = createActor(logic, { input: 1 });
actor.on('increased', (event) => {
  event.upBy; // typed as number
});
```

### Optional event handlers

Event handler keys in `on` are now optional. A missing handler is a no-op (returns snapshot unchanged). This is especially useful with event schemas — you can declare the event contract up front and implement handlers incrementally:

```ts
const store = createStore({
  schemas: {
    events: {
      inc: schema<{ by: number }>(),
      reset: schema<{}>()
    }
  },
  context: { count: 0 },
  on: {
    inc: (ctx, ev) => ({ count: ctx.count + ev.by })
    // 'reset' declared but not yet handled — no-ops at runtime
  }
});

store.trigger.reset(); // typechecks, no-ops
```

---

## Breaking changes

### `emits` config property

The `emits` config has been replaced by `schemas.emitted`. Emitting still works via `enq.emit` in transition functions — only the type declaration changed.

```diff
  const store = createStore({
    context: { count: 0 },
-   emits: {
-     increased: (_: { upBy: number }) => {}
-   },
+   schemas: {
+     emitted: {
+       increased: schema<{ upBy: number }>()
+     }
+   },
    on: {
      inc: (ctx, _, enq) => {
        enq.emit.increased({ upBy: 1 });
        return { ...ctx, count: ctx.count + 1 };
      }
    }
  });
```

### Framework-specific subpath exports

`@xstate/store/react` and `@xstate/store/solid` have been extracted to separate packages.

```diff
- import { useSelector } from '@xstate/store/react';
+ import { useSelector } from '@xstate/store-react';
```

```diff
- import { useSelector } from '@xstate/store/solid';
+ import { useSelector } from '@xstate/store-solid';
```

### `createStoreWithProducer` removed

`createStoreWithProducer` has been removed. Use `createStore` directly.

```diff
- import { createStoreWithProducer } from '@xstate/store';
- const store = createStoreWithProducer(produce, {
-   context: { count: 0 },
-   on: {
-     inc: (ctx, ev: { by: number }) => { ctx.count += ev.by; }
-   }
- });
```

### `createStore(context, transitions)` two-arg API removed

The deprecated two-argument form of `createStore` has been removed. Use the config object form.

### Inspection events consolidated

The three inspection event types (`@xstate.actor`, `@xstate.snapshot`, `@xstate.event`) have been replaced by a single `@xstate.transition` event. `inspect()` now emits the **current** snapshot on subscribe (not the initial snapshot).

```diff
  store.inspect((ev) => {
-   // ev.type: '@xstate.actor' | '@xstate.snapshot' | '@xstate.event'
+   // ev.type: '@xstate.transition'
+   // ev.event and ev.snapshot always present
  });

  // On subscribe, immediately receives:
- { type: '@xstate.actor', ... }
- { type: '@xstate.snapshot', snapshot: initialSnapshot, ... }
+ { type: '@xstate.transition', event: { type: '@xstate.init' }, snapshot: currentSnapshot, ... }
```

### `createAtom` getter simplified

The computed atom getter no longer receives a `read` function. Access other atoms via `.get()` directly. The `prev` argument is still available as the first (and only) parameter.

```diff
- const doubled = createAtom((read) => read(countAtom) * 2);
+ const doubled = createAtom(() => countAtom.get() * 2);

- const withPrev = createAtom((read, prev) => read(countAtom) + (prev ?? 0));
+ const withPrev = createAtom((prev) => countAtom.get() + (prev ?? 0));
```
