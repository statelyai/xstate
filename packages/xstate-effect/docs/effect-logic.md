---
title: Effect actor logic
description: Turn Effects and Streams into actor logic.
---

Three functions turn Effect values into [actor logic](../actor-logic.md) that a machine can invoke or spawn. All three must run under `createEffectActor`.

| Function | Actor behavior |
| --- | --- |
| `fromEffect` | Runs an Effect. Output is the Effect's success value. |
| `fromEffectStream` | Runs a Stream. `context` is the most recent item. |
| `fromEffectEventStream` | Runs a Stream of events and relays each one to the parent. |

## `fromEffect`

`fromEffect` accepts an Effect, a function that returns an Effect, or a config object with `id`, `schemas`, `validator` and `effect`.

```ts
fromEffect(Effect.succeed('done'));

fromEffect(({ input }: { input: string }) => Effect.succeed(input.length));

fromEffect({
  id: 'loadUser',
  schemas: {
    input: Schema.Struct({ id: Schema.String }),
    output: Schema.Struct({ id: Schema.String })
  },
  effect: ({ input }) => Api.use((api) => api.fetchUser(input.id))
});
```

Either schema may be omitted, and the missing type is inferred from the Effect. See [schemas and actions](schemas-and-actions.md) for how schemas are validated.

The actor's snapshot holds no context of its own. It is `active` while the Effect runs, `done` with the Effect's success value as `output`, or `error`.

### `EffectSourceArgs`

The function form receives `EffectSourceArgs<TInput>`:

| Field | Description |
| --- | --- |
| `input` | The actor's input. |
| `self` | The actor's own reference. |
| `system` | The actor [system](../systems.md). |
| `emit` | Emits an event that `actor.on(...)` and `emitted(actor)` observe. |

```ts
fromEffect(({ input, emit }: EffectSourceArgs<{ id: string }>) =>
  Effect.sync(() => {
    emit({ type: 'loaded', id: input.id });
    return input.id;
  })
);
```

The function is called once per actor start, so it sees that actor's input.

### Exits

The actor's result maps from the Effect's exit.

| Exit | Actor |
| --- | --- |
| Success | Status `done`, value as `output`. |
| Failure | Status `error` with the `E` value as `error`. `invoke.onError` receives it typed. |
| Defect | Status `error` with the squashed cause. Defects are not part of the typed error. |
| Interrupted by the actor stopping or the invoking state exiting | No error. The actor is stopped. |
| Interrupted from inside the Effect | Status `error` with an `EffectInterruptedError`. |

`Effect.interrupt` inside the Effect is a self-interruption, so it produces an `EffectInterruptedError` carrying the interrupt `cause`. `Effect.timeout` is a failure with `Cause.TimeoutError`, not an interruption. A lost `Effect.race` inside the Effect interrupts only the loser, and the actor completes with the winner.

Use `Effect.timeout`, `Effect.retry` and the other Effect combinators inside the Effect. `fromEffect` adds no options of its own for them. See [testing and errors](testing-and-errors.md#retries-and-supervision).

## `fromEffectStream`

`fromEffectStream` exposes the latest stream item as the actor's `context` and reaches `done` with no output when the stream completes. A stream failure puts the actor in the `error` status. It accepts a Stream, a function returning one, or a config object with `id`, `schemas`, `validator` and `stream`.

```ts
fromEffectStream(Stream.make(1, 2, 3));

fromEffectStream({
  schemas: { input: Schema.Struct({ topic: Schema.String }) },
  stream: ({ input }) => Stream.fromPubSub(topicPubSub(input.topic))
});
```

Read the latest item from the actor's snapshot rather than from events:

```ts
const ticker = fromEffectStream(Stream.make(1, 2, 3));

const latest = Effect.gen(function* () {
  const actor = yield* createEffectActor(ticker);
  const snapshot = yield* waitFor(actor, (s) => s.context !== undefined);
  return snapshot.context;
});
```

## `fromEffectEventStream`

`fromEffectEventStream` relays each stream item to the parent machine as an event, the way `fromEventObservable` does. The actor has no output: it reaches `done` when the stream completes and `error` when it fails. It accepts the same forms as `fromEffectStream`.

```ts
const machine = createMachine({
  context: { seen: 0 },
  schemas: { events: { VALUE: types<{ value: number }>() } },
  initial: 'active',
  states: {
    active: {
      invoke: {
        src: fromEffectEventStream(
          Stream.make({ type: 'VALUE', value: 1 }, { type: 'VALUE', value: 2 })
        )
      },
      on: {
        VALUE: ({ context, event }) => ({
          context: { seen: context.seen + event.value }
        })
      }
    }
  }
});
```

## Spans

Each of the three runs its Effect inside a span named after the function: `fromEffect`, `fromEffectStream` or `fromEffectEventStream`. See [tracing](testing-and-errors.md#tracing).
