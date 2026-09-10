import { createFSM, setup, types } from 'xstate/fsm';
import * as fsmEntry from 'xstate/fsm';

const log = (message: string) => console.log(message);

/**
 * 1. The whole API without schemas: a pure transition table.
 *
 * `createFSM` never starts anything. It returns `{ id, config, initialState,
 * transition }`, and `transition(state, event)` is a plain function of the
 * current state and the event.
 */
const toggleFSM = createFSM({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: { on: { toggle: 'active' } },
    active: { on: { toggle: 'inactive' } }
  }
});

log('=== pure transition table');
let toggleState = toggleFSM.initialState;
log(`initial: ${toggleState.value}`);
for (const _ of [1, 2, 3]) {
  toggleState = toggleFSM.transition(toggleState, { type: 'toggle' });
  log(`toggle -> ${toggleState.value}`);
}

// An event with no transition in the current state returns the same snapshot
// object, by reference. There is no error, no warning, and no actor to notify.
const unchanged = toggleFSM.transition(toggleState, { type: 'toggle-nope' });
log(`unhandled event returns same object: ${unchanged === toggleState}`);

/**
 * 2. Typed events and context via `setup()` from `xstate/fsm`.
 *
 * This is the same `setup(...).createFSM(...)` shape as `xstate`'s
 * `setup(...).createMachine(...)`, minus everything that needs a runtime:
 * there are no `actions`, `guards`, `actors` or `delays` keys to pass.
 */
const keypadSetup = setup({
  schemas: {
    context: types<{ entered: string; attempts: number }>(),
    events: {
      digit: types<{ value: string }>(),
      clear: types<{}>(),
      submit: types<{}>()
    }
  }
});

const PIN = '1234';

const keypadFSM = keypadSetup.createFSM({
  id: 'keypad',
  initial: 'entering',
  context: { entered: '', attempts: 0 },
  states: {
    entering: {
      on: {
        // A transition function receives `{ context, event }` and returns
        // `{ target?, context? }`, or `undefined` for "do nothing".
        digit: ({ context, event }) =>
          context.entered.length >= PIN.length
            ? undefined
            : { context: { entered: context.entered + event.value } },
        // Object form: a context patch with no target stays in the state.
        clear: { context: { entered: '' } },
        submit: ({ context }) =>
          context.entered === PIN
            ? { target: 'unlocked' }
            : context.attempts >= 2
              ? { target: 'locked', context: { entered: '' } }
              : {
                  context: { entered: '', attempts: context.attempts + 1 }
                }
      }
    },
    unlocked: { on: { clear: 'entering' } },
    // A state with no `on` is terminal by construction: every event returns
    // the same snapshot.
    locked: {}
  }
});

log('\n=== typed setup FSM');

// Driving an FSM is a fold over events. This is the whole runtime.
const drive = <TSnapshot, TEvent>(
  fsm: { transition(snapshot: TSnapshot, event: TEvent): TSnapshot },
  snapshot: TSnapshot,
  events: TEvent[]
) =>
  events.reduce((current, event) => fsm.transition(current, event), snapshot);

const wrongPin = drive(keypadFSM, keypadFSM.initialState, [
  { type: 'digit', value: '9' },
  { type: 'digit', value: '9' },
  { type: 'digit', value: '9' },
  { type: 'digit', value: '9' },
  { type: 'submit' }
]);
log(
  `after a wrong PIN: ${wrongPin.value} (attempts: ${wrongPin.context.attempts})`
);

const rightPin = drive(keypadFSM, wrongPin, [
  { type: 'digit', value: '1' },
  { type: 'digit', value: '2' },
  { type: 'digit', value: '3' },
  { type: 'digit', value: '4' },
  { type: 'submit' }
]);
log(`after the right PIN: ${rightPin.value}`);

const lockedOut = drive(keypadFSM, keypadFSM.initialState, [
  { type: 'submit' },
  { type: 'submit' },
  { type: 'submit' }
]);
log(`after three failures: ${lockedOut.value}`);
log(
  `locked is terminal: ${
    keypadFSM.transition(lockedOut, { type: 'submit' }) === lockedOut
  }`
);

/**
 * 3. Per-state context schemas make the snapshot a discriminated union.
 *
 * `states[name].schemas.context` refines the root context while that state is
 * active, exactly as in a full XState machine. The payoff is that
 * `snapshot.value === 'loaded'` narrows `snapshot.context`.
 */
type User = { id: string; name: string };

const requestSetup = setup({
  schemas: {
    events: {
      fetch: types<{ id: string }>(),
      resolve: types<{ user: User }>(),
      reject: types<{ message: string }>()
    }
  },
  states: {
    idle: { schemas: { context: types<{ status: 'idle' }>() } },
    loading: {
      schemas: { context: types<{ status: 'loading'; id: string }>() }
    },
    loaded: { schemas: { context: types<{ status: 'loaded'; user: User }>() } },
    failed: {
      schemas: { context: types<{ status: 'failed'; message: string }>() }
    }
  }
});

const requestFSM = requestSetup.createFSM({
  initial: 'idle',
  context: { status: 'idle' },
  states: {
    idle: {
      on: {
        fetch: ({ event }) => ({
          target: 'loading',
          context: { status: 'loading' as const, id: event.id }
        })
      }
    },
    loading: {
      on: {
        resolve: ({ event }) => ({
          target: 'loaded',
          context: { status: 'loaded' as const, user: event.user }
        }),
        reject: ({ event }) => ({
          target: 'failed',
          context: { status: 'failed' as const, message: event.message }
        })
      }
    },
    loaded: {},
    failed: {
      on: {
        fetch: ({ event }) => ({
          target: 'loading',
          context: { status: 'loading' as const, id: event.id }
        })
      }
    }
  }
});

log('\n=== per-state context schemas');

const describe = (snapshot: typeof requestFSM.initialState) => {
  // The snapshot is a union keyed by `value`, so each branch sees only the
  // context fields that state declares.
  switch (snapshot.value) {
    case 'idle':
      return 'idle';
    case 'loading':
      return `loading ${snapshot.context.id}`;
    case 'loaded':
      return `loaded ${snapshot.context.user.name}`;
    case 'failed':
      return `failed: ${snapshot.context.message}`;
  }
};

const loading = requestFSM.transition(requestFSM.initialState, {
  type: 'fetch',
  id: 'u_1'
});
log(describe(loading));
log(
  describe(
    requestFSM.transition(loading, {
      type: 'resolve',
      user: { id: 'u_1', name: 'Ada' }
    })
  )
);
log(
  describe(
    requestFSM.transition(loading, { type: 'reject', message: 'timeout' })
  )
);

/**
 * 4. Compile-time contracts. Each probe below is a real type error; `tsc`
 * fails if any of them ever starts compiling.
 */

// @ts-expect-error undeclared event types are rejected
requestFSM.transition(requestFSM.initialState, { type: 'nope' });

// @ts-expect-error event payloads must match their schema
requestFSM.transition(requestFSM.initialState, { type: 'fetch', id: 1 });

// @ts-expect-error a declared per-state context schema makes initial context required
requestSetup.createFSM({ initial: 'idle', states: { idle: {} } });

requestSetup.createFSM({
  initial: 'idle',
  context: { status: 'idle' },
  states: {
    idle: {
      on: {
        // @ts-expect-error a bare string target cannot carry incompatible context
        fetch: 'loading'
      }
    },
    loading: {},
    loaded: {},
    failed: {}
  }
});

/**
 * 5. What `xstate/fsm` deliberately does not have.
 *
 * The entry point exports exactly three values, and nothing that runs.
 */
log('\n=== the entry point surface');
const exportNames = Object.keys(fsmEntry)
  // The workspace build re-exports through CJS, which adds a `module.exports`
  // key that is not part of the public API.
  .filter((name) => /^[a-zA-Z]+$/.test(name))
  .sort();
log(`exports: ${exportNames.join(', ')}`);
for (const absent of [
  'createActor',
  'createMachine',
  'assign',
  'raise',
  'spawnChild',
  'fromPromise',
  'createAsyncLogic'
]) {
  log(`  ${absent}: ${absent in fsmEntry ? 'present' : 'absent'}`);
}

// The definition is plain data, so it can be serialized, diffed, or fed to a
// visualizer, and the same shape ports to `createMachine` when the machine
// grows to need actions, timers, actors or nesting.
log(
  `\nkeypad config states: ${Object.keys(keypadFSM.config.states).join(', ')}`
);
log(`keypad config is JSON-shaped: ${JSON.stringify(toggleFSM.config)}`);
