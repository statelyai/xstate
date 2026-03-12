/**
 * ScopedSetup — Userland helper for defining XState machines with per-state
 * type scoping. Drop this file into your project and import from it.
 *
 * ## Problem
 *
 * Large machines with hundreds of events/actions/guards cause TypeScript to
 * choke — `context.` autocomplete takes 7+ seconds because every state node
 * must evaluate `TransitionsConfig<AllEvents>`, `Actions<AllActions>`, etc.
 *
 * ## Solution
 *
 * Define each state (or group of states) with a **scope** that only includes
 * the events, actions, and guards it actually uses. TypeScript evaluates a tiny
 * type universe per state. Then `composeMachine` merges everything into a real
 * machine with the full runtime implementations.
 *
 * ## Usage
 *
 * ```ts
 * import { assign } from 'xstate';
 * import { scopedSetup } from './scopedSetup';
 *
 * type Ctx = { count: number; query: string; results: string[] };
 *
 * const s = scopedSetup({ types: { context: {} as Ctx } });
 *
 * // Each scope narrows to just its events — TS is fast here
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
 *     | { type: 'SEARCH'; query: string }
 *     | { type: 'RESULTS'; data: string[] }
 *   >()
 *   .extend({
 *     actions: {
 *       setQuery: assign({ query: ({ event }) => event.query }),
 *       setResults: assign({ results: ({ event }) => event.data })
 *     }
 *   });
 *
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
 * // Compose — auto-collects implementations from all scoped states
 * const machine = s.composeMachine({
 *   id: 'app',
 *   initial: 'idle',
 *   context: { count: 0, query: '', results: [] },
 *   states: { idle, searching, decrementing: { on: { INC: 'idle' } } }
 * });
 *
 * // machine is a real xstate StateMachine — use with createActor() as normal
 * ```
 */

import { setup } from './setup';
import type { EventObject, MachineContext, NonReducibleUnknown } from './types';

// ---------------------------------------------------------------------------
// Internal plumbing
// ---------------------------------------------------------------------------

/** Symbol used to tag state configs with their scope's implementations. */
const SCOPE_META = Symbol.for('xstate.scopedSetup.meta');

interface ScopeMeta {
  actions?: Record<string, any>;
  guards?: Record<string, any>;
  delays?: Record<string, any>;
}

/**
 * Wraps a `setup()` return value so that:
 *
 * - `createStateConfig()` tags its result with implementation metadata
 * - `extend()` preserves the wrapping and merges implementations
 *
 * The wrapper preserves the original TypeScript types — the user sees the same
 * `SetupReturn<...>` type and gets full autocomplete/type-checking.
 */
function wrapSetupReturn<T>(setupReturn: T, implementations: ScopeMeta): T {
  // Shallow copy preserves all typed properties (assign, raise, sendTo, etc.)
  const wrapped: any = {};
  for (const key of Object.getOwnPropertyNames(setupReturn)) {
    wrapped[key] = (setupReturn as any)[key];
  }

  // Override createStateConfig to embed scope metadata in the result
  wrapped.createStateConfig = (config: any) => {
    // Call the original for type-level validation
    const result = (setupReturn as any).createStateConfig(config);
    Object.defineProperty(result, SCOPE_META, {
      value: implementations,
      enumerable: false, // invisible to xstate's runtime & Object.keys
      configurable: true
    });
    return result;
  };

  // Override extend to capture new implementations and re-wrap
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

/** Recursively walks state configs and collects scope metadata. */
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

    // Recurse into nested states (compound / parallel state nodes)
    if (state.states && typeof state.states === 'object') {
      collectImplementations(state.states, into);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a scoped machine builder. The shared context type is defined once
 * here, then each scope narrows only the events (and optionally actions,
 * guards, delays) it cares about.
 *
 * @param _opts - Must include `types.context` for the shared context type. The
 *   value is only used for type inference (not at runtime).
 */
export function scopedSetup<TContext extends MachineContext>(_opts: {
  types: { context: TContext };
}) {
  /**
   * Creates a **scope** — a narrowed view of the machine's type universe.
   *
   * Pass the event union as a type parameter. The returned object is a real
   * xstate `setup()` result (with `createStateConfig`, `assign`, `raise`, etc.)
   * but typed to only the events you specified.
   *
   * Use `.extend()` to add named actions, guards, and delays with full
   * contextual typing (xstate's own `extend()` handles this).
   *
   * ```ts
   * const scope = s.createScope<{ type: 'FOO' } | { type: 'BAR'; x: number }>()
   *   .extend({
   *     actions: { doFoo: assign({ ... }) },
   *     guards:  { canBar: ({ context }) => ... },
   *   });
   *
   * const myState = scope.createStateConfig({ on: { FOO: { actions: 'doFoo' } } });
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
   * Walks all `states` (including nested states), collects the action/guard/
   * delay implementations that were registered via scopes, and builds the
   * machine with a single `setup().createMachine()` call.
   *
   * You can optionally pass a type parameter for the full event union, which
   * gives you typed `actor.send()` on the resulting machine. If omitted, the
   * event type defaults to `EventObject`.
   *
   * ```ts
   * type AllEvents = CounterEvents | SearchEvents | NavEvents;
   *
   * const machine = s.composeMachine<AllEvents>({
   *   id: 'app',
   *   initial: 'idle',
   *   context: { ... },
   *   states: { idle, searching, results },
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
    // Collect all implementations from scoped state configs
    const collected = {
      actions: {} as Record<string, any>,
      guards: {} as Record<string, any>,
      delays: {} as Record<string, any>
    };
    collectImplementations(config.states, collected);

    const hasActions = Object.keys(collected.actions).length > 0;
    const hasGuards = Object.keys(collected.guards).length > 0;
    const hasDelays = Object.keys(collected.delays).length > 0;

    // Build the real machine with all collected implementations
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
