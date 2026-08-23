---
title: Cheatsheet
description: Copy-paste reference for every XState v6 API.
---

Every snippet on this page is v6 syntax. See [migrate from v5 to v6](xstate-v5-to-v6.md) if you are coming from v5.

## Install

```bash
npm install xstate@alpha
```

```ts
import { createActor, createMachine, setup } from 'xstate';
```

## Create a machine

```ts
const machine = createMachine({
  id: 'checkout',
  version: '1.0.0',
  schemas: {
    context: z.object({ total: z.number() }),
    events: { submit: z.object({}), cancel: z.object({}) }
  },
  context: { total: 0 },
  initial: 'idle',
  states: {
    idle: { on: { submit: { target: 'paying' } } },
    paying: {},
    done: { type: 'final' }
  }
});
```

```ts
// lazy context from input
context: ({ input }) => ({ total: input.total })

// context in a transition: return the complete next context
on: {
  add: ({ context, event }) => ({
    context: { ...context, total: context.total + event.amount }
  })
}
```

See [machine configuration](configuration.md) and [context](context.md).

## Transitions

```ts
// object form
on: { submit: { target: 'loading' } }

// function form: return a target, context, or undefined
on: {
  submit: ({ context, event }, enq) => {
    if (!context.valid) return; // undefined = event not handled
    enq(() => track('submitted'));
    return { target: 'loading', context: { ...context, at: Date.now() } };
  }
}

// targetless: update context, stay in the state
on: { rename: ({ context, event }) => ({ context: { ...context, name: event.name } }) }

// re-enter the source state (runs exit + entry again)
on: { restart: { target: 'active', reenter: true } }

// forbid a parent transition from a child state
on: { cancel: undefined }

// wildcards
on: { 'pointer.*': { target: 'tracking' }, '*': { target: 'unknown' } }

// eventless
always: { target: 'ready' }
```

There is no `guard` transition property and no transition arrays. One event maps to one transition; branch inside the function. See [transitions](transitions.md).

```ts
// select one payload of an event type
on: {
  'xstate.done.actor': { matches: { actorId: 'job' }, target: 'complete' }
}
```

## Guards

```ts
// conditions are plain JS inside the transition function
on: {
  submit: ({ context }) => {
    if (!context.isValid) return;
    if (context.role === 'admin') return { target: 'adminReview' };
    return { target: 'standardReview' };
  }
}
```

```ts
// named guards
const machine = createMachine({
  guards: {
    hasStock: ({ context }) => context.available >= context.quantity
  },
  initial: 'browsing',
  states: {
    browsing: {
      on: {
        addItem: (args) => {
          if (!args.guards.hasStock(args)) return;
          return { target: 'adding' };
        }
      }
    },
    adding: {}
  }
});
```

```ts
// check another state (replaces stateIn)
import { checkStateIn } from 'xstate';

play: ({ self }) => {
  if (checkStateIn(self.getSnapshot(), 'volume.muted')) return;
  return { target: 'playing' };
};
```

See [guards](guards.md).

## Enqueue effects

<!-- enqueue methods and supported call sites from packages/core/src/types.ts and packages/core/src/stateUtils.ts -->

```ts
entry: ({ context, children, actions }, enq) => {
  enq(() => startEffect());              // any effect function
  enq(actions.notify, { msg: 'Hello' }); // named action, params first
  enq.raise({ type: 'tick' }, { delay: 300, id: 'debounce' });
  enq.cancel('debounce');
  enq.sendTo(children.worker, { type: 'ping' });
  enq.emit({ type: 'opened' });
  enq.log(context.total, 'total');
  const child = enq.spawn('upload', { id: 'upload', input: { file } });
  enq.stop(child);
};
```

`enq.listen(...)` and `enq.subscribeTo(...)` are available in transition,
`entry` and `exit` functions:

```ts
entry: (_, enq) => {
  const upload = enq.spawn(uploadLogic, { id: 'upload' });

  enq.listen(upload, 'upload.*', (event) => ({
    type: 'uploadEvent',
    eventType: event.type
  }));

  enq.subscribeTo(upload, {
    done: (output) => ({ type: 'uploadFinished', output }),
    error: (error) => ({ type: 'uploadFailed', error }),
    snapshot: (snapshot) => ({ type: 'progress', snapshot })
  });
};
```

See [actions](actions.md) and [listen and subscribe](listen-and-subscribe.md).

## Delays and timeouts

```ts
// delayed transition, canceled when the state is exited
loading: { after: { 5_000: { target: 'timedOut' } } }
loading: { after: { '5s': { target: 'timedOut' } } }

// named delays
setup({ delays: { retryDelay: 1_000 } });
loading: { after: { retryDelay: { target: 'idle' } } }

// state deadline; onTimeout is required with timeout
waiting: { timeout: '5s', onTimeout: { target: 'escalated' } }
waiting: { timeout: ({ context }) => context.slaMs, onTimeout: { target: 'escalated' } }

// delayed events
enq.raise({ type: 'search' }, { delay: 300, id: 'debounce' });
enq.cancel('debounce');
```

Durations: `250`, `'250ms'`, `'5s'`, `'1.5s'`, and ISO 8601 such as `'PT1M30S'`, `'PT2H'`, `'P1D'`. Plain `'5m'` and `'1h'` are not accepted. See [delays](delays.md) and [timeouts](timeouts.md).

## Invoke

```ts
loading: {
  invoke: {
    id: 'request',
    src: loadUser,
    input: ({ context }) => ({ id: context.userId }),
    registryKey: 'request',
    timeout: 5_000, // milliseconds only
    onTimeout: { target: 'timedOut' },
    onDone: ({ context, event }) => ({
      target: 'ready',
      context: { ...context, user: event.output }
    }),
    onError: { target: 'failed' },
    onSnapshot: ({ context, event }) => ({
      context: { ...context, progress: event.snapshot.context.progress }
    })
  }
}

// several actors in one state
invoke: [{ src: heartbeat, id: 'heartbeat' }, { src: syncLogic, id: 'sync' }]

// talk to the child
on: { cancel: ({ children }, enq) => enq.sendTo(children.request, { type: 'cancel' }) }
```

Only `src` is required. See [invoke](invoke.md).

## Spawn

```ts
on: {
  'file.added': ({ context, event }, enq) => {
    const upload = enq.spawn(uploadLogic, {
      id: `upload-${event.fileId}`,
      input: { file: event.file },
      syncSnapshot: true
    });

    return { context: { ...context, uploads: [...context.uploads, upload] } };
  }
}

// spawn from the context initializer (persistable)
context: ({ spawn, actors }) => ({
  connection: spawn(actors.connection, { id: 'connection' })
});
```

See [spawn](spawn.md).

## Actor logic

```ts
import {
  createAsyncLogic,
  createCallbackLogic,
  createObservableLogic,
  createEventObservableLogic,
  createLogic,
  createEmptyActor,
  TimeoutError
} from 'xstate';

// one async operation
const chargeCard = createAsyncLogic({
  id: 'chargeCard',
  timeout: '10s',
  run: async ({ input, signal }, enq) => {
    const charge = await enq.step('charge', () =>
      createCharge(input.amount, { signal })
    );
    enq.emit({ type: 'charged', id: charge.id });
    return charge;
  }
});

// callback API or subscription
const socketLogic = createCallbackLogic<{ type: 'send'; message: string }>(
  ({ receive, sendBack, emit }) => {
    const socket = new WebSocket('wss://example.com');
    receive((event) => {
      if (event.type === 'send') socket.send(event.message);
    });
    return () => socket.close();
  }
);

// observable
const ticks = createObservableLogic(() => interval(1000));

// stateful custom logic
const counterLogic = createLogic({
  id: 'counter',
  context: { count: 0 },
  run: ({ context, event }, enq) => {
    if (event.type !== 'inc') return;
    enq.emit({ type: 'counted' });
    enq.effect('poll', () => {
      const id = setInterval(() => fetch('/status'), 1000);
      return () => clearInterval(id);
    });
    return { context: { count: context.count + 1 } };
  }
});
```

See [actor logic](actor-logic.md).

## Create an actor

```ts
const actor = createActor(machine, {
  id: 'checkout',
  input: { userId: 'u_1' },
  snapshot: restored,
  inspect: (event) => console.log(event),
  clock: new SimulatedClock(),
  logger: console.log,
  registryKey: 'checkout'
});

const subscription = actor.subscribe({
  next: (snapshot) => render(snapshot),
  error: (error) => reportError(error),
  complete: () => console.log('done')
});

actor.on('order.placed', (event) => toast(event.id));
actor.on('*', (event) => analytics.track(event.type));

actor.start();
actor.send({ type: 'submit' });
actor.trigger.submit(); // typed shorthand from schemas.events

const total = actor.select((snapshot) => snapshot.context.total);
total.get();
total.subscribe((value) => render(value));

actor.getSnapshot();
actor.getPersistedSnapshot();
subscription.unsubscribe();
actor.stop();
```

See [create actors](create-actor.md) and [selectors](selectors.md).

## Snapshots

```ts
const snapshot = actor.getSnapshot();

snapshot.value;
snapshot.context;
snapshot.status; // 'active' | 'done' | 'error' | 'stopped'
snapshot.output; // only when status is 'done'
snapshot.error; // only when status is 'error'
snapshot.children.upload?.getSnapshot();
snapshot.tags; // Set<string>

snapshot.matches('idle');
snapshot.matches({ checkout: { payment: 'authorizing' } });
snapshot.can({ type: 'submit' });
snapshot.hasTag('busy');
snapshot.getMeta(); // { 'machine.uploading': { label: 'Uploading…' } }
snapshot.getInputs();
snapshot.toJSON();
```

See [snapshots](snapshots.md) and [states](states.md).

## State node kinds

```ts
// final state completes its parent; onDone belongs to the parent
sent: { type: 'final', output: ({ context }) => ({ id: context.id }) }
uploading: { states: { sent: { type: 'final' } }, onDone: { target: 'uploaded' } }

// history state; a non-empty default target is required
hist: { type: 'history', target: 'stopped' }
deepHist: { type: 'history', history: 'deep', target: 'details' }

// parallel state; no initial, each region declares its own
active: {
  type: 'parallel',
  states: {
    playback: { initial: 'stopped', states: { stopped: {}, playing: {} } },
    volume: { initial: 'audible', states: { audible: {}, muted: {} } }
  }
}
on: { reset: { target: ['playback.stopped', 'volume.audible'] } }

// choice state: pass-through branch point, must resolve to a target
routing: {
  type: 'choice',
  choice: (args) => {
    if (args.guards.isVip(args)) return { target: 'vipFlow' };
    return { target: 'standardFlow' };
  }
}

// route state: needs an explicit id and a route
checkout: { id: 'checkout', route: {} }
review: { id: 'review', route: ({ context }) => context.ready }
actor.send({ type: 'xstate.route', to: '#review' });

// state input: schema in setup(...), value on the transition
const s = setup({
  states: { loading: { schemas: { input: z.object({ id: z.string() }) } } }
});
s.createMachine({
  initial: { target: 'loading', input: { id: 'a1' } },
  states: { loading: { entry: ({ input }) => input.id } }
});
```

See [final](final-states.md), [history](history-states.md), [parallel](parallel-states.md), [choice](choice-states.md), [route](route-states.md) and [state input](state-input.md).

## Internal events

```ts
createMachine({
  schemas: {
    events: { start: z.object({}) },
    internalEvents: {
      tick: z.object({}),
      'change.*': z.object({ value: z.string() })
    }
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        start: (_, enq) => enq.raise({ type: 'tick' }),
        tick: { target: 'done' }
      }
    },
    done: {}
  }
});
```

Types declared in `schemas.internalEvents` can be raised inside the machine
but throw when sent from outside. See [internal events](internal-events.md).

## Setup and provide

```ts
const orderSetup = setup({
  schemas: {
    context: z.object({ total: z.number() }),
    events: { submit: z.object({}) },
    actions: { track: { params: z.object({ key: z.string() }) } }
  },
  actions: { notify: (params: { msg: string }) => toast(params.msg) },
  guards: { isPositive: ({ total }: { total: number }) => total > 0 },
  actors: { chargeCard },
  delays: { retry: 1_000 },
  states: { paying: { schemas: { input: z.object({ id: z.string() }) } } }
});

const state = orderSetup.createStateConfig({ on: { go: { target: 'paying' } } });
const machine = orderSetup.createMachine({ context: { total: 0 }, initial: 'idle' });
const testMachine = machine.provide({ actors: { chargeCard: fakeChargeCard } });
```

`provide(...)` replaces implementations only. See [setup and provide](setup-and-provide.md).

## Persistence

```ts
const persisted = actor.getPersistedSnapshot();
localStorage.setItem('checkout', JSON.stringify(persisted));

const restored = createActor(machine, {
  snapshot: JSON.parse(localStorage.getItem('checkout')!)
}).start();

// migrate across machine versions
const versions = machineVersions([checkoutV1, checkoutV2]);
const snapshot = await versions.migrateSnapshot(persisted, {
  to: '2',
  migrations: { '1': async (s) => ({ ...s, context: { total: s.context.count } }) }
});
```

See [persistence](persistence.md) and [persist and restore actors](persist-and-restore-actors.md).

## TypeScript

```ts
import { types } from 'xstate';
import type {
  ActorRefFrom,
  SnapshotFrom,
  EventFromLogic,
  InputFrom,
  OutputFrom
} from 'xstate';

// schemas without a runtime schema library
schemas: {
  context: types<{ count: number }>(),
  events: { inc: types<{ by: number }>() }
}

type Actor = ActorRefFrom<typeof machine>;
type Snapshot = SnapshotFrom<typeof machine>;
type Event = EventFromLogic<typeof machine>;
type Input = InputFrom<typeof machine>;
type Output = OutputFrom<typeof machine>;
```

`types<T>()` provides inference only; use Zod or another Standard Schema to validate at runtime. See [TypeScript](typescript.md).

## Utilities

```ts
import {
  waitFor,
  toPromise,
  initialTransition,
  transition,
  mapState,
  SimulatedClock
} from 'xstate';

await waitFor(actor, (snapshot) => snapshot.matches('ready'), {
  timeout: 5_000,
  signal: request.signal
});
const output = await toPromise(actor);

// pure calculations, no actor started and no effects run
const [initialSnapshot] = initialTransition(machine, input);
const [nextSnapshot] = transition(machine, snapshot, { type: 'submit' });

// control time in tests
const clock = new SimulatedClock();
const testActor = createActor(machine, { clock }).start();
clock.increment(5_000);
```

See [utilities](utilities.md) and [test XState logic](testing.md).
