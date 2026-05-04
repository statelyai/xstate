# @xstate/store v4 Migration Guide

This guide covers changes in `packages/xstate-store` only.

## Added

### `createAsyncStore`

`createAsyncStore(...)` creates stores with async transition handlers. Awaited
transition work must go through `await enq.step(stepId, exec)` so the store can
suspend and resume through `snapshot.async`.

```ts
import { createAsyncStore } from '@xstate/store';
import { z } from 'zod';

const store = createAsyncStore({
  context: {
    result: undefined as number | undefined
  },
  schemas: {
    emitted: {
      loaded: z.object({
        result: z.number()
      })
    }
  },
  on: {
    load: async (_context, _event, enq) => {
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

store.trigger.load();
```

While async work is in progress, `store.getSnapshot().async` contains execution
state keyed by an internal execution id:

```ts
{
  "<execution-id>": {
    event: { type: "load" },
    steps: {
      async: { status: "active" },
      fetchResult: { status: "active" }
    }
  }
}
```

Resolved steps are replayed by step id. When the async transition completes,
the execution entry is removed from `snapshot.async`.

```ts
const store = createAsyncStore({
  context: { result: 0 },
  on: {
    load: async (context, _event, enq) => {
      const first = await enq.step('first', () => fetchFirst());
      const second = await enq.step('second', () => fetchSecond());

      return { result: context.result + first + second };
    }
  }
});
```

Async handlers are not supported by `createStore(...)` or
`createStoreTransition(...)`. Move async transitions to `createAsyncStore(...)`
and make each awaited operation an `enq.step(...)`.

### Standard Schema typing

Store configs now accept `schemas` for type inference from any
[Standard Schema](https://standardschema.dev/) compatible library. This can type
context, accepted events, and emitted events.

```ts
import { createStore } from '@xstate/store';
import { z } from 'zod';

const store = createStore({
  schemas: {
    context: z.object({
      count: z.number(),
      label: z.string()
    }),
    events: {
      rename: z.object({
        label: z.string()
      })
    },
    emitted: {
      renamed: z.object({
        label: z.string()
      })
    }
  },
  context: { count: 0, label: 'ready' },
  on: {
    rename: (context, event, enq) => {
      enq.emit.renamed({ label: event.label });

      return {
        ...context,
        label: event.label
      };
    }
  }
});
```

`fromStore(...)` also accepts `schemas` and can infer context, event, and
emitted-event types from schema definitions.

```ts
import { fromStore } from '@xstate/store';
import { z } from 'zod';

const logic = fromStore({
  context: (initialCount: number) => ({ count: initialCount }),
  schemas: {
    emitted: {
      increased: z.object({
        by: z.number()
      })
    }
  },
  on: {
    inc: (context, event: { by: number }, enq) => {
      enq.emit.increased({ by: event.by });
      return { count: context.count + event.by };
    }
  }
});
```

The root package now exports `StandardSchemaV1`, async store types, and helper
types such as `AsyncStoreConfig`, `AsyncStoreAssigner`, `AsyncEnqueueObject`,
`StoreSchemas`, `InferSchemaOutput`, `InferSchemaPayloadMap`,
`ResolveStoreContext`, `ResolveStoreEventPayloadMap`, and
`ResolveStoreEmittedPayloadMap`.

### Optional schema-declared handlers

When events are declared through `schemas.events`, matching handlers in `on` are
optional. Missing handlers are no-ops, but the event still exists for typing and
`store.trigger`.

```ts
import { createStore } from '@xstate/store';
import { z } from 'zod';

const store = createStore({
  schemas: {
    events: {
      inc: z.object({
        by: z.number()
      }),
      reset: z.object({})
    }
  },
  context: { count: 0 },
  on: {
    inc: (context, event) => ({ count: context.count + event.by })
  }
});

store.trigger.reset(); // no-op
```

### Async persistence support

The `@xstate/store/persist` extension now persists active `snapshot.async`
state. A `createAsyncStore(...)` created from a persisted snapshot resumes
in-progress async work automatically.

```ts
const restoredStore = createAsyncStore({
  ...config,
  snapshot: persistedSnapshot
});
```

## Changed

### Emitted event declarations moved to `schemas.emitted`

The `emits` config property has been replaced by `schemas.emitted`. Emitting
events with `enq.emit` is unchanged; only the type declaration moved.

```diff
  const store = createStore({
    context: { count: 0 },
-   emits: {
-     increased: (_payload: { by: number }) => {}
-   },
+   schemas: {
+     emitted: {
+       increased: z.object({
+         by: z.number()
+       })
+     }
+   },
    on: {
      inc: (context, event: { by: number }, enq) => {
        enq.emit.increased({ by: event.by });
        return { count: context.count + event.by };
      }
    }
  });
```

### Store inspection emits one transition event

`store.inspect(...)` now emits a single `@xstate.transition` event shape instead
of separate `@xstate.actor`, `@xstate.event`, and `@xstate.snapshot` events.

```diff
  store.inspect((inspectionEvent) => {
-   // '@xstate.actor' | '@xstate.event' | '@xstate.snapshot'
+   // '@xstate.transition'
+   inspectionEvent.event;
+   inspectionEvent.snapshot;
  });
```

Subscribing to inspection immediately emits the current snapshot as an
`@xstate.transition` event with `{ type: '@xstate.init' }`. Previously,
inspection emitted actor/snapshot events and used the initial snapshot on
subscribe.

### `store.get()` is the readable read

Stores are now `Readable<StoreSnapshot<TContext>>` values. Use:

- `store.getSnapshot()` for explicit snapshot access.
- `store.get()` when reading the store as a reactive/tracked readable value.

The two methods currently return the same snapshot, but they communicate
different intent.

### Computed atom getters no longer receive `read`

Computed atoms now read other atoms directly through `.get()`. The previous
value remains available as the first argument.

```diff
- const doubled = createAtom((read) => read(countAtom) * 2);
+ const doubled = createAtom(() => countAtom.get() * 2);

- const withPrev = createAtom((read, prev) => read(countAtom) + (prev ?? 0));
+ const withPrev = createAtom((prev) => countAtom.get() + (prev ?? 0));
```

### `store.trigger` is concrete when event types are known

For config-created stores, `store.trigger` is now built from known event types.
Those event types come from `schemas.events` when present, otherwise from
`Object.keys(on)`. Extension events such as `reset`, `undo`, and `redo` are also
added when those extensions are applied.

Unknown trigger names no longer exist on those concrete trigger objects. If a
store is created from custom logic without event type metadata, `trigger` keeps
the previous proxy behavior.

### Store extensions reserve their internal event names

In development, applying `reset()` to a store that already declares a `reset`
event now throws. Applying `undoRedo()` to a store that already declares `undo`
or `redo` now throws.

The `persist(...)` extension also reserves its internal rehydration event
(`__persist.rehydrate`).

Rename the conflicting application event before applying the extension.

### Persistence writes snapshots, not just context

`persist(...)` still stores context by default, but it now derives the persisted
value from the full store snapshot so active async executions can be included
when present. The stored shape is still context-based, with an additional
top-level `async` property only while async executions are active. If you use
`pick`, it still receives the context value and controls the persisted context
portion.

`clearStorage(store)` and `flushStorage(store)` may now return a `Promise` when
the configured storage adapter is async.

## Deleted

### `@xstate/store/react` and `@xstate/store/solid`

The framework-specific subpath exports were removed from `@xstate/store`. Use
the dedicated framework packages instead.

```diff
- import { useSelector } from '@xstate/store/react';
+ import { useSelector } from '@xstate/store-react';
```

```diff
- import { useSelector } from '@xstate/store/solid';
+ import { useSelector } from '@xstate/store-solid';
```

The `react` and `solid` package folders are no longer published by
`@xstate/store`, and `react` / `solid-js` are no longer peer dependencies of
`@xstate/store`.

### `createStoreWithProducer`

`createStoreWithProducer(...)` was removed. Use `createStore(...)` and call your
producer inside transition handlers.

```diff
- import { createStoreWithProducer } from '@xstate/store';
+ import { createStore } from '@xstate/store';
  import { produce } from 'immer';

- const store = createStoreWithProducer(produce, {
+ const store = createStore({
    context: { count: 0 },
    on: {
-     inc: (context) => {
-       context.count++;
-     }
+     inc: (context) =>
+       produce(context, (draft) => {
+         draft.count++;
+       })
    }
  });
```

### `createStore(context, transitions)`

The deprecated two-argument `createStore(context, transitions)` API was removed.
Use the config object form.

```diff
- const store = createStore(
-   { count: 0 },
-   {
-     inc: (context) => ({ count: context.count + 1 })
-   }
- );
+ const store = createStore({
+   context: { count: 0 },
+   on: {
+     inc: (context) => ({ count: context.count + 1 })
+   }
+ });
```

### `undoRedo(config, options)`

The deprecated config-wrapping form of `undoRedo(...)` was removed. Use the
extension form with `.with(...)`.

```diff
- const store = createStore(
-   undoRedo({
-     context: { count: 0 },
-     on: {
-       inc: (context) => ({ count: context.count + 1 })
-     }
-   })
- );
+ const store = createStore({
+   context: { count: 0 },
+   on: {
+     inc: (context) => ({ count: context.count + 1 })
+   }
+ }).with(undoRedo());
```

### Public `_snapshot` access

Stores no longer expose `_snapshot`. Use `store.getSnapshot()` for explicit
snapshot reads, or `store.get()` when reading the store as a `Readable`.
