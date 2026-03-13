/**
 * CreateScopedState — Copy-paste this file into your project.
 *
 * Userland helper for defining XState state configs with per-state type
 * scoping. Improves TypeScript performance for large machines by narrowing the
 * event/action/guard types per state, so TS doesn't evaluate the entire type
 * universe at every state definition.
 *
 * ## Why
 *
 * In a large machine with 200+ events, 100+ actions, and 50+ guards, `context.`
 * autocomplete can take 7+ seconds because every `StateNodeConfig` must
 * evaluate `TransitionsConfig<AllEvents>`, `Actions<AllActions>`, etc.
 *
 * This helper lets you define each state with a **scope** that only includes
 * the events/actions/guards it uses. TypeScript evaluates a tiny type universe
 * per state.
 *
 * ## Quick start
 *
 * ```ts
 * import { setup, assign } from 'xstate';
 * import { createScopedState } from './scopedSetup.standalone';
 *
 * const s = setup({
 *   types: {
 *     context: {} as { count: number; query: string },
 *     events: {} as
 *       | { type: 'INC' }
 *       | { type: 'DEC'; by: number }
 *       | { type: 'SEARCH'; q: string }
 *       | { type: 'RESULTS'; data: string[] }
 *   },
 *   actions: {
 *     inc: assign({ count: ({ context }) => context.count + 1 }),
 *     setQuery: assign({ query: ({ event }) => event.q })
 *   },
 *   guards: {
 *     isPositive: ({ context }) => context.count > 0
 *   }
 * });
 *
 * // Each state only sees its relevant events — TS is fast here
 * const idle = createScopedState(s, {
 *   events: ['INC', 'DEC'], // autocomplete from all event types
 *   actions: ['inc'], // autocomplete from all action names
 *   guards: ['isPositive'], // autocomplete from all guard names
 *   on: {
 *     INC: { actions: 'inc', guard: 'isPositive' },
 *     DEC: 'counting'
 *   }
 * });
 *
 * const searching = createScopedState(s, {
 *   events: ['SEARCH', 'RESULTS'],
 *   actions: ['setQuery'],
 *   on: {
 *     SEARCH: { actions: 'setQuery' },
 *     RESULTS: { target: 'idle' }
 *   }
 * });
 *
 * // Use states in createMachine as normal
 * const machine = s.createMachine({
 *   initial: 'idle',
 *   context: { count: 0, query: '' },
 *   states: { idle, searching, counting: { on: { INC: 'idle' } } }
 * });
 * ```
 */

import type { StateMachine } from 'xstate';

// ---------------------------------------------------------------------------
// Type extraction from a setup() return value
// ---------------------------------------------------------------------------

/** Extracts the StateMachine type from a setup return's createMachine method */
type SetupMachine<T> = T extends {
  createMachine: (...args: any[]) => infer M;
}
  ? M
  : never;

// StateMachine has 14 type params:
// TContext(1), TEvent(2), TChildren(3), TActor(4), TAction(5), TGuard(6),
// TDelay(7), TStateValue(8), TTag(9), TInput(10), TOutput(11),
// TEmitted(12), TMeta(13), TStateSchema(14)

type _Event<M> =
  M extends StateMachine<
    any,
    infer E,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any
  >
    ? E
    : never;

type _Action<M> =
  M extends StateMachine<
    any,
    any,
    any,
    any,
    infer A,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any
  >
    ? A
    : never;

type _Guard<M> =
  M extends StateMachine<
    any,
    any,
    any,
    any,
    any,
    infer G,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any
  >
    ? G
    : never;

type _Delay<M> =
  M extends StateMachine<
    any,
    any,
    any,
    any,
    any,
    any,
    infer D,
    any,
    any,
    any,
    any,
    any,
    any,
    any
  >
    ? D
    : never;

/** Event type strings from a setup() return */
type EventTypeOf<T> =
  _Event<SetupMachine<T>> extends { type: infer U } ? U & string : string;

/** Action name strings from a setup() return */
type ActionNameOf<T> =
  _Action<SetupMachine<T>> extends {
    type: infer U;
  }
    ? U & string
    : string;

/** Guard name strings from a setup() return */
type GuardNameOf<T> =
  _Guard<SetupMachine<T>> extends {
    type: infer U;
  }
    ? U & string
    : string;

/** Delay name strings from a setup() return */
type DelayNameOf<T> =
  _Delay<SetupMachine<T>> extends string ? _Delay<SetupMachine<T>> : string;

// ---------------------------------------------------------------------------
// Simplified (lightweight) state config types
// ---------------------------------------------------------------------------

type ActionRef<TActionName extends string> =
  | TActionName
  | { type: TActionName; params?: any }
  | ((...args: any[]) => any); // inline actions (assign, raise, etc.)

type GuardRef<TGuardName extends string> =
  | TGuardName
  | { type: TGuardName; params?: any }
  | ((...args: any[]) => any); // inline guard predicates

interface ScopedTransition<
  TActionName extends string,
  TGuardName extends string
> {
  target?: string;
  guard?: GuardRef<TGuardName>;
  actions?: ActionRef<TActionName> | Array<ActionRef<TActionName>>;
  reenter?: boolean;
  description?: string;
}

type TransitionValue<TActionName extends string, TGuardName extends string> =
  | string
  | ScopedTransition<TActionName, TGuardName>
  | Array<ScopedTransition<TActionName, TGuardName>>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a state config with narrowed types for better TypeScript performance.
 * Pass the `setup()` return and specify which events, actions, and guards this
 * state uses. The `on` config will only accept the listed events, and
 * action/guard references are scoped to the listed names.
 *
 * At runtime this is nearly identity — it just strips the `events`, `actions`,
 * and `guards` arrays and returns the rest as a plain state config object.
 *
 * @param _setup - The return value of xstate's `setup()`
 * @param config - Scoping arrays + state node configuration
 * @returns A plain state config object compatible with `createMachine`
 */
export function createScopedState<
  TSetup extends { createStateConfig: (config: any) => any },
  const TEventNames extends EventTypeOf<TSetup>,
  const TActionNames extends ActionNameOf<TSetup> = ActionNameOf<TSetup>,
  const TGuardNames extends GuardNameOf<TSetup> = GuardNameOf<TSetup>
>(
  _setup: TSetup,
  config: {
    /** Which event types this state handles (autocompletes from setup) */
    events: TEventNames[];
    /**
     * Which named actions this state uses (autocompletes from setup). Optional
     * — if omitted, all actions are available.
     */
    actions?: TActionNames[];
    /**
     * Which named guards this state uses (autocompletes from setup). Optional —
     * if omitted, all guards are available.
     */
    guards?: TGuardNames[];

    // ---- State node configuration (narrowed to the scope) ----

    on?: {
      [K in TEventNames]?: TransitionValue<TActionNames, TGuardNames>;
    };
    entry?: ActionRef<TActionNames> | Array<ActionRef<TActionNames>>;
    exit?: ActionRef<TActionNames> | Array<ActionRef<TActionNames>>;
    always?: TransitionValue<TActionNames, TGuardNames>;
    after?: Record<string | number, TransitionValue<TActionNames, TGuardNames>>;

    // ---- Structural ----

    initial?: string;
    type?: 'parallel' | 'final' | 'history';
    history?: 'shallow' | 'deep';
    states?: Record<string, any>;
    invoke?: any;
    tags?: string | string[];
    description?: string;
    output?: any;
    meta?: any;
  }
) {
  // Strip the scoping arrays, return just the state config.
  // Type safety is enforced on the INPUT (config parameter).
  // The output is cast so it's assignable to createMachine's states.
  const {
    events: _events,
    actions: _actions,
    guards: _guards,
    ...stateConfig
  } = config;
  return stateConfig as any;
}
