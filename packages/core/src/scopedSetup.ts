/**
 * CreateScopedState — Helper for defining XState state configs with per-state
 * type scoping. Improves TypeScript performance for large machines by narrowing
 * the event/action/guard types per state.
 *
 * ## Usage
 *
 * ```ts
 * import { setup, assign, createScopedState } from 'xstate';
 *
 * const s = setup({
 *   types: {
 *     context: {} as { count: number; query: string },
 *     events: {} as
 *       | { type: 'INC' }
 *       | { type: 'DEC'; by: number }
 *       | { type: 'SEARCH'; q: string }
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
 * // Scoped to specific events — TS only evaluates these types
 * const idle = createScopedState(s, {
 *   events: ['INC', 'DEC'],
 *   actions: ['inc'],
 *   guards: ['isPositive'],
 *   on: {
 *     INC: { actions: 'inc', guard: 'isPositive' },
 *     DEC: {
 *       actions: ({ context, event }) => {
 *         // context: { count: number; query: string }
 *         // event:   { type: 'DEC'; by: number }
 *       }
 *     }
 *   }
 * });
 *
 * // Use '*' for all events/actions/guards (no scoping)
 * const other = createScopedState(s, {
 *   events: '*',
 *   on: { INC: { actions: 'inc' } }
 * });
 *
 * const machine = s.createMachine({
 *   initial: 'idle',
 *   context: { count: 0, query: '' },
 *   states: { idle, counting: { on: { INC: 'idle' } } }
 * });
 * ```
 */

import { StateMachine } from './StateMachine';
import type { EventObject, MachineContext } from './types';

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

type SetupMachine<T> = T extends {
  createMachine: (...args: any[]) => infer M;
}
  ? M
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

type ActionNameOf<T> =
  _Action<SetupMachine<T>> extends { type: infer U } ? U & string : string;

type GuardNameOf<T> =
  _Guard<SetupMachine<T>> extends { type: infer U } ? U & string : string;

// ---------------------------------------------------------------------------
// Simplified (lightweight) state config types — with typed inline functions
// ---------------------------------------------------------------------------

// Prevents TS from back-inferring generic params through function arguments.
// Same pattern as xstate's internal DoNotInfer.
type Frozen<T> = [T][T extends any ? 0 : any];

type ActionRef<
  TActionName extends string,
  TContext extends MachineContext = any,
  TEvent extends EventObject = any
> =
  | TActionName
  | { type: TActionName; params?: any }
  | ((args: { context: Frozen<TContext>; event: Frozen<TEvent> }) => void);

// Accepts results from enqueueActions(), assign(), raise(), etc.
// Uses `object` as escape hatch — TS prefers the more specific function
// type in ActionRef for contextual typing of inline arrow functions.
type ActionValue<
  TActionName extends string,
  TContext extends MachineContext = any,
  TEvent extends EventObject = any
> = ActionRef<TActionName, TContext, TEvent> | (object & { _out_TEvent?: any });

type GuardRef<
  TGuardName extends string,
  TContext extends MachineContext = any,
  TEvent extends EventObject = any
> =
  | TGuardName
  | { type: TGuardName; params?: any }
  | ((args: { context: Frozen<TContext>; event: Frozen<TEvent> }) => boolean);

interface ScopedTransition<
  TActionName extends string,
  TGuardName extends string,
  TContext extends MachineContext = any,
  TEvent extends EventObject = any
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
  TContext extends MachineContext = any,
  TEvent extends EventObject = any
> =
  | string
  | ScopedTransition<TActionName, TGuardName, TContext, TEvent>
  | Array<ScopedTransition<TActionName, TGuardName, TContext, TEvent>>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createScopedState<
  TSetup extends { createStateConfig: (config: any) => any },
  const TEventNames extends EventTypeOf<TSetup> = EventTypeOf<TSetup>,
  const TActionNames extends ActionNameOf<TSetup> = ActionNameOf<TSetup>,
  const TGuardNames extends GuardNameOf<TSetup> = GuardNameOf<TSetup>
>(
  _setup: TSetup,
  config: {
    events: TEventNames[] | '*';
    actions?: TActionNames[] | '*';
    guards?: TGuardNames[] | '*';
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
  const {
    events: _events,
    actions: _actions,
    guards: _guards,
    ...stateConfig
  } = config;
  // Type safety is enforced on the INPUT (config parameter).
  // The output is cast so it's assignable to createMachine's states.
  return stateConfig as any;
}
