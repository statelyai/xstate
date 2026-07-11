import isDevelopment from '#is-development';
import { XSTATE_STOP } from '../constants.ts';
import { createActor } from '../createActor.ts';
import type { AnyActorSystem } from '../system.ts';
import type {
  ActorScope,
  AnyActorLogic,
  AnyActorRef,
  EventObject,
  Snapshot
} from '../types.ts';

export type FanOutJoin = 'all' | 'allSettled' | 'race' | 'any';

export interface FanOutOptions {
  join?: FanOutJoin;
  concurrency?: number;
}

export interface FanOutItem {
  index: number;
  key: string;
  item: unknown;
  input: unknown;
}

/**
 * Resolves an invoke definition's `items` into the fan-out logic's input: one
 * entry per item carrying its stable key and mapped per-item input.
 */
export function resolveFanOutItems(
  invokeDef: {
    items?: unknown;
    key?: unknown;
    input?: unknown;
  },
  inputArgs: Record<string, unknown>
): FanOutItem[] {
  const rawItems =
    typeof invokeDef.items === 'function'
      ? invokeDef.items(inputArgs)
      : invokeDef.items;

  return Array.from(
    (rawItems ?? []) as Iterable<unknown>,
    (item, index): FanOutItem => ({
      index,
      key:
        typeof invokeDef.key === 'function'
          ? invokeDef.key({ ...inputArgs, item, index })
          : String(index),
      item,
      input:
        typeof invokeDef.input === 'function'
          ? invokeDef.input({ ...inputArgs, item, index })
          : invokeDef.input !== undefined
            ? invokeDef.input
            : item
    })
  );
}

/**
 * Re-wraps restored child logic in fan-out logic when its persisted entry
 * carries the fan-out marker (the persisted `src` only names the per-item
 * logic).
 */
export function restoreFanOutLogic(
  logic: AnyActorLogic,
  entry: { fanout?: FanOutOptions }
): AnyActorLogic {
  return entry.fanout ? createFanOutLogic(logic, entry.fanout) : logic;
}

/**
 * Extra persisted-child-entry props for a fan-out invocation; `undefined` for
 * ordinary children. Spread into the entry written by `getPersistedSnapshot`.
 */
export function getFanOutPersistedProps(child: {
  logic?: { fanout?: FanOutOptions };
}): { fanout: FanOutOptions } | undefined {
  return child.logic?.fanout ? { fanout: child.logic.fanout } : undefined;
}

export type FanOutSettledResult<TOutput = unknown> =
  | { status: 'fulfilled'; output: TOutput; key: string; index: number }
  | { status: 'rejected'; error: unknown; key: string; index: number };

/**
 * Persistable bookkeeping for a fan-out invocation. Holds no live actor refs
 * (those live on the snapshot's `children`), so it round-trips cleanly.
 */
interface FanOutContext {
  items: FanOutItem[];
  join: FanOutJoin;
  concurrency: number;
  nextIndex: number;
  active: string[];
  settledCount: number;
  results: unknown[];
  settled: FanOutSettledResult[];
  errors: unknown[];
}

export interface FanOutSnapshot {
  status: 'active' | 'done' | 'error' | 'stopped';
  output: unknown;
  error: unknown;
  input: FanOutItem[] | undefined;
  context: FanOutContext;
  children: Record<string, AnyActorRef>;
}

type FanOutEvent = EventObject & {
  actorId?: string;
  output?: unknown;
  error?: unknown;
};

type FanOutActorScope = ActorScope<
  any,
  FanOutEvent,
  AnyActorSystem,
  EventObject
>;

function toConcurrency(concurrency: number | undefined) {
  if (concurrency === undefined || concurrency === Infinity) {
    return Infinity;
  }
  return Math.max(1, Math.floor(concurrency));
}

export function createFanOutLogic(
  logic: AnyActorLogic,
  options: FanOutOptions = {}
) {
  const join = options.join ?? 'all';
  const concurrency = toConcurrency(options.concurrency);

  function createInitialContext(items: FanOutItem[]): FanOutContext {
    return {
      items,
      join,
      concurrency,
      nextIndex: 0,
      active: [],
      settledCount: 0,
      results: [],
      settled: [],
      errors: []
    };
  }

  function validateKeys(items: FanOutItem[]) {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.key)) {
        throw new Error(
          isDevelopment
            ? `Duplicate fanout item key "${item.key}". Each fanout item must have a unique key.`
            : `Duplicate fanout item key`
        );
      }
      seen.add(item.key);
    }
  }

  /**
   * Launches as many pending items as the concurrency budget allows, creating a
   * child actor per item and deferring its start (children never start
   * synchronously inside a transition). Returns the next `children`/`context`.
   */
  function launchMore(
    snapshot: FanOutSnapshot,
    actorScope: FanOutActorScope
  ): { children: Record<string, AnyActorRef>; context: FanOutContext } {
    const { context } = snapshot;
    const children = { ...snapshot.children };
    const active = context.active.slice();
    let nextIndex = context.nextIndex;

    while (active.length < concurrency && nextIndex < context.items.length) {
      const item = context.items[nextIndex];
      nextIndex++;
      if (children[item.key]) {
        continue;
      }
      const actor = createActor(logic, {
        id: item.key,
        input: item.input,
        parent: actorScope.self as any
      });
      children[item.key] = actor;
      active.push(item.key);
      forwardEmitted(actor, item, actorScope);
      actorScope.defer(() => actor.start());
    }

    return { children, context: { ...context, active, nextIndex } };
  }

  /**
   * Forwards a child's emitted events out of the fan-out wrapper so the parent
   * machine can observe them. Each event is re-emitted from the fan-out actor
   * augmented with the settling item's identity under a `fanout` key — `{
   * ...emittedEvent, fanout: { key, index } }` — without clobbering the
   * original event shape.
   */
  function forwardEmitted(
    actor: AnyActorRef,
    item: { key: string; index: number },
    actorScope: FanOutActorScope
  ) {
    (actor as any).on('*', (emittedEvent: EventObject) => {
      actorScope.emit({
        ...emittedEvent,
        fanout: { key: item.key, index: item.index }
      } as EventObject);
    });
  }

  function stopChildren(
    children: Record<string, AnyActorRef>,
    actorScope: FanOutActorScope
  ) {
    for (const child of Object.values(children)) {
      actorScope.defer(() => (child as any)._stop());
    }
  }

  const transition = (
    snapshot: FanOutSnapshot,
    event: FanOutEvent,
    actorScope: FanOutActorScope
  ): [FanOutSnapshot, unknown[]] => {
    if (snapshot.status !== 'active') {
      return [snapshot, []];
    }

    if (event.type === XSTATE_STOP) {
      stopChildren(snapshot.children, actorScope);
      return [
        { ...snapshot, status: 'stopped', input: undefined, children: {} },
        []
      ];
    }

    const { actorId } = event;
    const isDoneEvent = event.type.startsWith('xstate.done.actor.');
    const isErrorEvent = event.type.startsWith('xstate.error.actor.');
    if (!actorId || (!isDoneEvent && !isErrorEvent)) {
      return [snapshot, []];
    }

    const { context } = snapshot;
    const item = context.items.find((i) => i.key === actorId);
    if (!item || !context.active.includes(item.key)) {
      return [snapshot, []];
    }

    // The settled child stopped itself; drop it from the live children.
    const children = { ...snapshot.children };
    delete children[item.key];
    const active = context.active.filter((key) => key !== item.key);
    const settledCount = context.settledCount + 1;

    // race: first *settled* item wins (fulfil → done, reject → error).
    if (join === 'race') {
      stopChildren(children, actorScope);
      return [
        {
          ...snapshot,
          children: {},
          status: isDoneEvent ? 'done' : 'error',
          output: isDoneEvent ? event.output : undefined,
          error: isDoneEvent ? undefined : event.error,
          context: { ...context, active: [], settledCount }
        },
        []
      ];
    }

    // any: first *fulfilled* item wins; if all reject → aggregated error.
    if (join === 'any') {
      if (isDoneEvent) {
        stopChildren(children, actorScope);
        return [
          {
            ...snapshot,
            children: {},
            status: 'done',
            output: event.output,
            context: { ...context, active: [], settledCount }
          },
          []
        ];
      }

      const errors = context.errors.slice();
      errors[item.index] = event.error;
      const nextContext: FanOutContext = {
        ...context,
        active,
        settledCount,
        errors
      };

      if (settledCount === context.items.length) {
        const ordered = context.items.map((i) => errors[i.index]);
        return [
          {
            ...snapshot,
            children: {},
            status: 'error',
            error: new AggregateError(ordered, 'All fanout items rejected'),
            context: nextContext
          },
          []
        ];
      }

      const launched = launchMore(
        { ...snapshot, children, context: nextContext },
        actorScope
      );
      return [
        { ...snapshot, children: launched.children, context: launched.context },
        []
      ];
    }

    // all / allSettled
    const results = context.results.slice();
    const settled = context.settled.slice();

    if (isDoneEvent) {
      results[item.index] = event.output;
      settled[item.index] = {
        status: 'fulfilled',
        output: event.output,
        key: item.key,
        index: item.index
      };
    } else if (join === 'all') {
      // First rejection fails the whole fan-out.
      stopChildren(children, actorScope);
      return [
        {
          ...snapshot,
          children: {},
          status: 'error',
          error: event.error,
          context: { ...context, active, settledCount }
        },
        []
      ];
    } else {
      settled[item.index] = {
        status: 'rejected',
        error: event.error,
        key: item.key,
        index: item.index
      };
    }

    const nextContext: FanOutContext = {
      ...context,
      active,
      settledCount,
      results,
      settled
    };

    if (settledCount === context.items.length) {
      return [
        {
          ...snapshot,
          children: {},
          status: 'done',
          output: join === 'allSettled' ? settled : results,
          context: nextContext
        },
        []
      ];
    }

    const launched = launchMore(
      { ...snapshot, children, context: nextContext },
      actorScope
    );
    return [
      { ...snapshot, children: launched.children, context: launched.context },
      []
    ];
  };

  function initialSnapshot(input: FanOutItem[] | undefined): FanOutSnapshot {
    const items = input ? Array.from(input) : [];
    validateKeys(items);

    const base = {
      output: undefined,
      error: undefined,
      input: items,
      context: createInitialContext(items),
      children: {} as Record<string, AnyActorRef>
    };

    if (!items.length) {
      if (join === 'race' || join === 'any') {
        return {
          ...base,
          status: 'error',
          error: new Error(
            `Cannot fan out over an empty list of items with join: '${join}'`
          )
        };
      }
      return { ...base, status: 'done', output: [] };
    }

    return { ...base, status: 'active' };
  }

  const logicObject: AnyActorLogic & {
    fanout: { join: FanOutJoin; concurrency?: number };
  } = {
    config: options,
    // Identifies this logic as a fan-out wrapper; read during machine
    // persistence so `restoreSnapshot` re-wraps the resolved `src` logic.
    // JSON-safe: unbounded concurrency is omitted rather than `Infinity`.
    fanout: {
      join,
      ...(Number.isFinite(concurrency) ? { concurrency } : {})
    },
    transition: transition as AnyActorLogic['transition'],
    initialTransition: (input: any) => [initialSnapshot(input), []],
    getInitialSnapshot: (_actorScope: any, input: any) =>
      initialSnapshot(input),
    start: (snapshot: any, actorScope: any) => {
      const scope = actorScope as FanOutActorScope;
      if (snapshot.status !== 'active') {
        return;
      }
      // Resume children that were active when persisted.
      for (const child of Object.values(
        snapshot.children as Record<string, AnyActorRef>
      )) {
        if (
          (child as any)._rehydrated &&
          (child as any).getSnapshot?.().status === 'active'
        ) {
          scope.defer(() => (child as any).start());
        }
      }
      // Launch fresh items (and top up any remaining capacity on restore).
      const launched = launchMore(snapshot, scope);
      snapshot.children = launched.children;
      snapshot.context = launched.context;
    },
    getPersistedSnapshot: (snapshot: any, options?: unknown) => {
      const childrenJson: Record<string, unknown> = {};
      for (const key in snapshot.children) {
        const child = snapshot.children[key] as any;
        childrenJson[key] = {
          snapshot: child.getPersistedSnapshot(options)
        };
      }
      return { ...snapshot, children: childrenJson } as Snapshot<unknown>;
    },
    restoreSnapshot: (persisted: any, actorScope: any) => {
      const children: Record<string, AnyActorRef> = {};
      const persistedChildren = persisted.children ?? {};
      const items: FanOutItem[] = persisted.context?.items ?? [];
      for (const key in persistedChildren) {
        const childSnapshot = persistedChildren[key].snapshot;
        const actor = createActor(logic, {
          id: key,
          parent: actorScope.self,
          snapshot: childSnapshot
        });
        (actor as any)._rehydrated = true;
        const item = items.find((i) => i.key === key);
        forwardEmitted(
          actor,
          { key, index: item ? item.index : -1 },
          actorScope as FanOutActorScope
        );
        children[key] = actor;
      }
      return { ...persisted, children } as FanOutSnapshot;
    }
  };

  return logicObject;
}
