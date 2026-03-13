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
 *   events: ['INC', 'DEC'],
 *   actions: ['inc'],
 *   guards: ['isPositive'],
 *   on: {
 *     INC: { actions: 'inc', guard: 'isPositive' },
 *     DEC: {
 *       actions: ({ context, event }) => {
 *         // context: { count: number; query: string }  — typed!
 *         // event:   { type: 'DEC'; by: number }       — narrowed per key!
 *       }
 *     }
 *   }
 * });
 *
 * // Use states in createMachine as normal
 * const machine = s.createMachine({
 *   initial: 'idle',
 *   context: { count: 0, query: '' },
 *   states: { idle, counting: { on: { INC: 'idle' } } }
 * });
 * ```
 */

import type { StateMachine } from 'xstate';

// ---------------------------------------------------------------------------
// Type extraction from a setup() return value
// ---------------------------------------------------------------------------

// Extract TContext and TEvent from setup()'s createAction method.
// createAction is NOT generic, so inference is reliable.
// Its parameter is ActionFunction<TContext, TEvent, TEvent, unknown, ...>
// which is callable: (args: { context: TContext; event: TEvent; ... }, params) => void

type ContextOf<T> = T extends {
  createAction: (
    action: (
      args: { context: infer C } & Record<string, any>,
      ...rest: any[]
    ) => any
  ) => any;
}
  ? C
  : any;

type EventOf<T> = T extends {
  createAction: (
    action: (
      args: { event: infer E } & Record<string, any>,
      ...rest: any[]
    ) => any
  ) => any;
}
  ? E
  : any;

type EventTypeOf<T> =
  EventOf<T> extends { type: infer U } ? U & string : string;

// For action/guard names, extract from StateMachine return type of createMachine.
// This works because TAction/TGuard are non-generic params in the return position.

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

// ---------------------------------------------------------------------------
// Simplified (lightweight) state config types — with typed inline functions
// ---------------------------------------------------------------------------

// EventObject-compatible constraint (avoids importing from xstate internals)
type EventLike = { type: string };
type ContextLike = Record<string, any>;

// Prevents TS from back-inferring generic params through function arguments.
// Same pattern as xstate's internal DoNotInfer.
type Frozen<T> = [T][T extends any ? 0 : any];

type ActionRef<
  TActionName extends string,
  TContext extends ContextLike = any,
  TEvent extends EventLike = any
> =
  | TActionName
  | { type: TActionName; params?: any }
  | ((args: { context: Frozen<TContext>; event: Frozen<TEvent> }) => void);

// Accepts results from enqueueActions(), assign(), raise(), etc.
// Uses `object` as escape hatch — TS prefers the more specific function
// type in ActionRef for contextual typing of inline arrow functions.
type ActionValue<
  TActionName extends string,
  TContext extends ContextLike = any,
  TEvent extends EventLike = any
> = ActionRef<TActionName, TContext, TEvent> | (object & { _out_TEvent?: any });

type GuardRef<
  TGuardName extends string,
  TContext extends ContextLike = any,
  TEvent extends EventLike = any
> =
  | TGuardName
  | { type: TGuardName; params?: any }
  | ((args: { context: Frozen<TContext>; event: Frozen<TEvent> }) => boolean);

interface ScopedTransition<
  TActionName extends string,
  TGuardName extends string,
  TContext extends ContextLike = any,
  TEvent extends EventLike = any
> {
  target?: string;
  guard?: GuardRef<TGuardName, TContext, TEvent>;
  actions?:
    | ActionValue<TActionName, TContext, TEvent>
    | Array<ActionValue<TActionName, TContext, TEvent>>;
  reenter?: boolean;
  description?: string;
}

type TransitionValue<
  TActionName extends string,
  TGuardName extends string,
  TContext extends ContextLike = any,
  TEvent extends EventLike = any
> =
  | string
  | ScopedTransition<TActionName, TGuardName, TContext, TEvent>
  | Array<ScopedTransition<TActionName, TGuardName, TContext, TEvent>>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a state config with narrowed types for better TypeScript performance.
 * Pass the `setup()` return and specify which events, actions, and guards this
 * state uses.
 *
 * - `on` keys are restricted to the listed events
 * - Action/guard references autocomplete from the listed names
 * - Inline `({ context, event })` callbacks are fully typed:
 *
 *   - `context` is your machine's context type
 *   - `event` is narrowed per `on` key (e.g. `RESET` → `{ type: 'RESET' }`)
 * - Results from `enqueueActions`, `assign`, `raise`, etc. are accepted
 *
 * At runtime this is near-identity — strips the scoping arrays, returns the
 * rest as a plain state config object.
 *
 * @param _setup - The return value of xstate's `setup()`
 * @param config - Scoping arrays + state node configuration
 * @returns A plain state config object compatible with `createMachine`
 */
export function createScopedState<
  TSetup extends { createStateConfig: (config: any) => any },
  const TEventNames extends EventTypeOf<TSetup> = EventTypeOf<TSetup>,
  const TActionNames extends ActionNameOf<TSetup> = ActionNameOf<TSetup>,
  const TGuardNames extends GuardNameOf<TSetup> = GuardNameOf<TSetup>
>(
  _setup: TSetup,
  config: {
    /** Which event types this state handles. Use '*' for all events. */
    events: TEventNames[] | '*';
    /** Which named actions this state uses. Use '*' for all. Omit for all. */
    actions?: TActionNames[] | '*';
    /** Which named guards this state uses. Use '*' for all. Omit for all. */
    guards?: TGuardNames[] | '*';

    // ---- State node configuration (narrowed to the scope) ----

    on?: {
      [K in TEventNames]?: TransitionValue<
        TActionNames,
        TGuardNames,
        ContextOf<TSetup>,
        Extract<EventOf<TSetup>, { type: K }>
      >;
    };
    entry?:
      | ActionValue<
          TActionNames,
          ContextOf<TSetup>,
          Extract<EventOf<TSetup>, { type: TEventNames }>
        >
      | Array<
          ActionValue<
            TActionNames,
            ContextOf<TSetup>,
            Extract<EventOf<TSetup>, { type: TEventNames }>
          >
        >;
    exit?:
      | ActionValue<
          TActionNames,
          ContextOf<TSetup>,
          Extract<EventOf<TSetup>, { type: TEventNames }>
        >
      | Array<
          ActionValue<
            TActionNames,
            ContextOf<TSetup>,
            Extract<EventOf<TSetup>, { type: TEventNames }>
          >
        >;
    always?: TransitionValue<
      TActionNames,
      TGuardNames,
      ContextOf<TSetup>,
      Extract<EventOf<TSetup>, { type: TEventNames }>
    >;
    after?: Record<
      string | number,
      TransitionValue<
        TActionNames,
        TGuardNames,
        ContextOf<TSetup>,
        Extract<EventOf<TSetup>, { type: TEventNames }>
      >
    >;

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
