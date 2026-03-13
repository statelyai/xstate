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
 * const idle = createScopedState(s, {
 *   events: ['INC', 'DEC'],
 *   actions: ['inc'],
 *   guards: ['isPositive'],
 *   on: {
 *     INC: { actions: 'inc', guard: 'isPositive' },
 *     DEC: 'counting'
 *   }
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

// ---------------------------------------------------------------------------
// Type extraction from a setup() return value
// ---------------------------------------------------------------------------

type SetupMachine<T> = T extends {
  createMachine: (...args: any[]) => infer M;
}
  ? M
  : never;

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

type EventTypeOf<T> =
  _Event<SetupMachine<T>> extends { type: infer U } ? U & string : string;

type ActionNameOf<T> =
  _Action<SetupMachine<T>> extends { type: infer U } ? U & string : string;

type GuardNameOf<T> =
  _Guard<SetupMachine<T>> extends { type: infer U } ? U & string : string;

// ---------------------------------------------------------------------------
// Simplified (lightweight) state config types
// ---------------------------------------------------------------------------

type ActionRef<TActionName extends string> =
  | TActionName
  | { type: TActionName; params?: any }
  | ((...args: any[]) => any);

type GuardRef<TGuardName extends string> =
  | TGuardName
  | { type: TGuardName; params?: any }
  | ((...args: any[]) => any);

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

export function createScopedState<
  TSetup extends { createStateConfig: (config: any) => any },
  const TEventNames extends EventTypeOf<TSetup>,
  const TActionNames extends ActionNameOf<TSetup> = ActionNameOf<TSetup>,
  const TGuardNames extends GuardNameOf<TSetup> = GuardNameOf<TSetup>
>(
  _setup: TSetup,
  config: {
    events: TEventNames[];
    actions?: TActionNames[];
    guards?: TGuardNames[];
    on?: {
      [K in TEventNames]?: TransitionValue<TActionNames, TGuardNames>;
    };
    entry?: ActionRef<TActionNames> | Array<ActionRef<TActionNames>>;
    exit?: ActionRef<TActionNames> | Array<ActionRef<TActionNames>>;
    always?: TransitionValue<TActionNames, TGuardNames>;
    after?: Record<string | number, TransitionValue<TActionNames, TGuardNames>>;
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
