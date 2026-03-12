/**
 * ScopedSetup — Copy-paste this file into your project.
 *
 * Userland helper for defining XState machines with per-state type scoping.
 * Improves TypeScript performance for large machines by narrowing the
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
 * per state. Then `composeMachine` merges everything into a real machine.
 *
 * ## Quick start
 *
 * ```ts
 * import { assign } from 'xstate';
 * import { scopedSetup } from './scopedSetup.standalone';
 *
 * type Ctx = { count: number; query: string; results: string[] };
 *
 * // 1. Create the builder with your shared context type
 * const s = scopedSetup({ types: { context: {} as Ctx } });
 *
 * // 2. Create scopes — each narrows to just its events
 * const counter = s
 *   .createScope<{ type: 'INC' } | { type: 'DEC'; by: number }>()
 *   .extend({
 *     actions: {
 *       inc: assign({ count: ({ context }) => context.count + 1 })
 *       //           ^ instant autocomplete — only 2 events in scope
 *     },
 *     guards: {
 *       isPositive: ({ context }) => context.count > 0
 *     }
 *   });
 *
 * const search = s
 *   .createScope<
 *     { type: 'SEARCH'; q: string } | { type: 'RESULTS'; data: string[] }
 *   >()
 *   .extend({
 *     actions: {
 *       setQuery: assign({ query: ({ event }) => event.q }),
 *       setResults: assign({ results: ({ event }) => event.data })
 *     }
 *   });
 *
 * // 3. Create state configs from scopes
 * const idle = counter.createStateConfig({
 *   on: {
 *     INC: { actions: 'inc', guard: 'isPositive' },
 *     DEC: 'decrementing'
 *   }
 * });
 *
 * const searching = search.createStateConfig({
 *   on: {
 *     SEARCH: { actions: 'setQuery' },
 *     RESULTS: { actions: 'setResults', target: 'idle' }
 *   }
 * });
 *
 * // 4. Compose — auto-collects implementations from all scoped states
 * type AllEvents =
 *   | { type: 'INC' }
 *   | { type: 'DEC'; by: number }
 *   | { type: 'SEARCH'; q: string }
 *   | { type: 'RESULTS'; data: string[] };
 *
 * const machine = s.composeMachine<AllEvents>({
 *   id: 'app',
 *   initial: 'idle',
 *   context: { count: 0, query: '', results: [] },
 *   states: { idle, searching, decrementing: { on: { INC: 'idle' } } }
 * });
 * ```
 */

import { setup } from 'xstate';
import type { EventObject, MachineContext, NonReducibleUnknown } from 'xstate';

// ---------------------------------------------------------------------------
// Internal plumbing
// ---------------------------------------------------------------------------

const SCOPE_META = Symbol.for('xstate.scopedSetup.meta');

interface ScopeMeta {
  actions?: Record<string, any>;
  guards?: Record<string, any>;
  delays?: Record<string, any>;
}

/**
 * Wraps a `setup()` return so that `createStateConfig()` tags results with
 * implementation metadata, and `extend()` preserves the wrapping.
 */
function wrapSetupReturn<T>(setupReturn: T, implementations: ScopeMeta): T {
  const wrapped: any = {};
  for (const key of Object.getOwnPropertyNames(setupReturn)) {
    wrapped[key] = (setupReturn as any)[key];
  }

  wrapped.createStateConfig = (config: any) => {
    const result = (setupReturn as any).createStateConfig(config);
    Object.defineProperty(result, SCOPE_META, {
      value: implementations,
      enumerable: false,
      configurable: true
    });
    return result;
  };

  wrapped.extend = (extOpts: any) => {
    const extResult = (setupReturn as any).extend(extOpts);
    const merged: ScopeMeta = {
      actions: { ...implementations.actions, ...extOpts.actions },
      guards: { ...implementations.guards, ...extOpts.guards },
      delays: { ...implementations.delays, ...extOpts.delays }
    };
    return wrapSetupReturn(extResult, merged);
  };

  return wrapped as T;
}

/** Recursively collects scope metadata from state configs. */
function collectImplementations(
  states: Record<string, any>,
  into: {
    actions: Record<string, any>;
    guards: Record<string, any>;
    delays: Record<string, any>;
  }
): void {
  for (const state of Object.values(states)) {
    if (!state || typeof state !== 'object') continue;

    const meta: ScopeMeta | undefined = state[SCOPE_META];
    if (meta) {
      if (meta.actions) Object.assign(into.actions, meta.actions);
      if (meta.guards) Object.assign(into.guards, meta.guards);
      if (meta.delays) Object.assign(into.delays, meta.delays);
    }

    if (state.states && typeof state.states === 'object') {
      collectImplementations(state.states, into);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a scoped machine builder. Define the shared context type once, then
 * create scopes that narrow to subsets of events/actions/guards.
 *
 * @param _opts - Must include `types.context` for the shared context type.
 */
export function scopedSetup<TContext extends MachineContext>(_opts: {
  types: { context: TContext };
}) {
  /**
   * Creates a scope with narrowed event types. Returns a wrapped xstate
   * `setup()` result — you get full type safety for `createStateConfig`,
   * `assign`, `raise`, etc., but only the events you specified are in scope.
   *
   * Chain `.extend()` to add named actions/guards/delays with full contextual
   * typing (uses xstate's own `.extend()` under the hood).
   *
   * @example
   *
   * ```ts
   * const scope = s.createScope<
   *   { type: 'FOO' } | { type: 'BAR'; x: number }
   * >().extend({
   *   actions: { doFoo: assign({ ... }) },
   *   guards:  { canBar: ({ context }) => ... },
   * });
   *
   * const myState = scope.createStateConfig({
   *   on: { FOO: { actions: 'doFoo' } }
   * });
   * ```
   */
  function createScope<TEvent extends EventObject>() {
    const s = setup({
      types: {} as {
        context: TContext;
        events: TEvent;
      }
    });
    return wrapSetupReturn(s, {});
  }

  /**
   * Composes scoped state configs into a real xstate `StateMachine`.
   *
   * Walks all states (including nested), collects action/guard/delay
   * implementations from scopes, and builds the machine via
   * `setup().createMachine()`.
   *
   * Optionally pass a type parameter for the full event union to get typed
   * `actor.send()` on the result.
   *
   * @example
   *
   * ```ts
   * type AllEvents = CounterEvents | SearchEvents;
   * const machine = s.composeMachine<AllEvents>({
   *   id: 'app',
   *   initial: 'idle',
   *   context: { ... },
   *   states: { idle, searching },
   * });
   * ```
   */
  function composeMachine<
    TEvent extends EventObject = EventObject,
    TInput = NonReducibleUnknown,
    TOutput extends NonReducibleUnknown = NonReducibleUnknown
  >(config: {
    id?: string;
    initial?: string;
    context: TContext | (({ input }: { input: TInput }) => TContext);
    states: Record<string, any>;
    type?: 'parallel';
    on?: Record<string, any>;
    entry?: any;
    exit?: any;
    output?: any;
  }) {
    const collected = {
      actions: {} as Record<string, any>,
      guards: {} as Record<string, any>,
      delays: {} as Record<string, any>
    };
    collectImplementations(config.states, collected);

    const hasActions = Object.keys(collected.actions).length > 0;
    const hasGuards = Object.keys(collected.guards).length > 0;
    const hasDelays = Object.keys(collected.delays).length > 0;

    const s = setup({
      types: {} as {
        context: TContext;
        events: TEvent;
        input: TInput;
        output: TOutput;
      },
      ...(hasActions ? { actions: collected.actions } : {}),
      ...(hasGuards ? { guards: collected.guards } : {}),
      ...(hasDelays ? { delays: collected.delays } : {})
    } as any);

    return s.createMachine(config as any);
  }

  return { createScope, composeMachine };
}
