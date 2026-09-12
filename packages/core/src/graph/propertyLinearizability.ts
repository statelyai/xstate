import type { AnyActorLogic, EventFromLogic, SnapshotFrom } from '../types.ts';
import { initialTransition, transition } from '../transition.ts';
import type { PropertySutContext } from './propertyTest.ts';

/**
 * One completed operation of a concurrent history: the event that was sent
 * (`invocation`), what the system under test answered (`response`), and the
 * interval during which the operation was in flight. Intervals may overlap.
 */
export interface LinearizabilityEntry<TEvent = unknown> {
  readonly id: string | number;
  /** The concurrent branch the operation ran on. Informational. */
  readonly actor?: string;
  readonly invocation: TEvent;
  readonly response: unknown;
  readonly start: number;
  readonly end: number;
}

/** The sequential specification a history is checked against. */
export interface LinearizabilityModel<TState, TEvent = unknown> {
  readonly initial: TState;
  readonly apply: (
    state: TState,
    event: TEvent
  ) => { readonly state: TState; readonly response: unknown };
  readonly equalResponse?: (model: unknown, observed: unknown) => boolean;
  /**
   * Returns a stable string identity for a state, used to memoize search
   * branches. Return `undefined` for states that cannot be serialized; those
   * branches are then explored without memoization. Defaults to
   * `JSON.stringify`.
   */
  readonly serializeState?: (state: TState) => string | undefined;
}

export interface LinearizabilityOptions {
  /**
   * Maximum number of candidate linearization steps to explore before giving
   * up. When the cap is hit the result is `linearizable: false` with
   * `truncated: true`, which means "not proven", not "proven wrong".
   */
  readonly maxExplored?: number;
}

export interface LinearizabilityResult<TEvent = unknown> {
  readonly linearizable: boolean;
  /** The sequential order that explains the history, when one was found. */
  readonly witness?: readonly LinearizabilityEntry<TEvent>[];
  readonly explored: number;
  readonly truncated: boolean;
}

const DEFAULT_MAXIMUM_EXPLORED = 100_000;

function defaultEqualResponse(model: unknown, observed: unknown): boolean {
  return deepEqual(model, observed);
}

/** Structural equality over plain JSON-like values. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
  );
}

function defaultSerializeState(state: unknown): string | undefined {
  try {
    return JSON.stringify(state);
  } catch {
    return undefined;
  }
}

/**
 * Decides whether a concurrent `history` is linearizable against a sequential
 * `model`: whether some total order of the operations, consistent with the
 * real-time order of non-overlapping operations, produces exactly the observed
 * responses.
 *
 * The search is the Wing–Gong just-in-time linearization: depth-first over the
 * operations that could come next (those starting no later than the earliest
 * end time still outstanding), backtracking whenever a response disagrees with
 * the model, and memoizing `(state, completed set)` pairs so equivalent
 * branches are explored once.
 */
export function checkLinearizable<TState, TEvent>(
  history: readonly LinearizabilityEntry<TEvent>[],
  model: LinearizabilityModel<TState, TEvent>,
  options: LinearizabilityOptions = {}
): LinearizabilityResult<TEvent> {
  const maxExplored = options.maxExplored ?? DEFAULT_MAXIMUM_EXPLORED;
  const equalResponse = model.equalResponse ?? defaultEqualResponse;
  const serializeState = model.serializeState ?? defaultSerializeState;
  const entries = history.slice();
  const remaining = entries.map(() => true);
  const witness: LinearizabilityEntry<TEvent>[] = [];
  const seen = new Set<string>();
  let explored = 0;
  let truncated = false;

  function memoKey(state: TState): string | undefined {
    const serializedState = serializeState(state);
    if (serializedState === undefined) {
      return undefined;
    }
    const completed = entries
      .map((_, index) => (remaining[index] ? '0' : '1'))
      .join('');
    return `${completed}|${serializedState}`;
  }

  function search(state: TState): boolean {
    if (remaining.every((isRemaining) => !isRemaining)) {
      return true;
    }
    const key = memoKey(state);
    if (key !== undefined) {
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
    }
    // An operation can be linearized next only if it started before every
    // outstanding operation finished; otherwise it would be reordered past an
    // operation that provably preceded it.
    let earliestEnd = Infinity;
    for (let index = 0; index < entries.length; index++) {
      if (remaining[index] && entries[index].end < earliestEnd) {
        earliestEnd = entries[index].end;
      }
    }
    for (let index = 0; index < entries.length; index++) {
      if (!remaining[index] || entries[index].start > earliestEnd) {
        continue;
      }
      if (explored >= maxExplored) {
        truncated = true;
        return false;
      }
      explored++;
      const entry = entries[index];
      const applied = model.apply(state, entry.invocation);
      if (!equalResponse(applied.response, entry.response)) {
        continue;
      }
      remaining[index] = false;
      witness.push(entry);
      if (search(applied.state)) {
        return true;
      }
      witness.pop();
      remaining[index] = true;
      if (truncated) {
        return false;
      }
    }
    return false;
  }

  const linearizable = search(model.initial);
  return {
    linearizable,
    witness: linearizable ? witness.slice() : undefined,
    explored,
    truncated
  };
}

/** The system under test driven by {@link runParallelPropertyCommands}. */
export interface ParallelPropertySutSession<TEvent> {
  /**
   * Sends an event. The resolved value is the operation's response; when it is
   * `undefined` the response is read back with `read()`, which makes a
   * `PropertySutSession` usable as-is.
   */
  readonly send: (event: TEvent, context?: unknown) => unknown;
  readonly read?: () => unknown;
  readonly dispose?: () => void | Promise<void>;
}

export interface ParallelPropertySut<TSnapshot, TEvent> {
  readonly create: (
    context: PropertySutContext<any, any>
  ) =>
    | ParallelPropertySutSession<TEvent>
    | Promise<ParallelPropertySutSession<TEvent>>;
  /** Projects a model snapshot to the value a response is compared against. */
  readonly projectModel: (snapshot: TSnapshot) => unknown;
  /** Projects a raw SUT response before comparison. */
  readonly projectSut?: (observed: unknown) => unknown;
}

export interface ParallelPropertyCommandsOptions<TLogic extends AnyActorLogic> {
  /** Events applied sequentially before the concurrent phase starts. */
  readonly prefix?: readonly EventFromLogic<TLogic>[];
  /** Each branch runs its events sequentially, all branches run concurrently. */
  readonly branches: readonly (readonly EventFromLogic<TLogic>[])[];
  readonly sut: ParallelPropertySut<
    SnapshotFrom<TLogic>,
    EventFromLogic<TLogic>
  >;
  readonly input?: unknown;
  readonly maxExplored?: number;
  readonly equalResponse?: (model: unknown, observed: unknown) => boolean;
}

export interface ParallelPropertyCommandsResult<
  TEvent
> extends LinearizabilityResult<TEvent> {
  readonly history: readonly LinearizabilityEntry<TEvent>[];
}

/**
 * Runs a sequential prefix and then N branches concurrently against a system
 * under test, records the resulting concurrent history, and checks it against
 * the machine's own pure `transition()` as the sequential specification.
 *
 * This is the analogue of `parallel_commands` in QuickCheck State Machine and
 * PropEr: the prefix puts the system in an interesting state, the branches
 * race, and linearizability decides whether the observed responses could have
 * come from any sequential interleaving.
 */
export async function runParallelPropertyCommands<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options: ParallelPropertyCommandsOptions<TLogic>
): Promise<ParallelPropertyCommandsResult<EventFromLogic<TLogic>>> {
  const projectSut =
    options.sut.projectSut ?? ((observed: unknown) => observed);
  const session = await options.sut.create({
    logic: logic as any,
    input: options.input,
    snapshot: undefined,
    label: () => {},
    counter: () => {}
  } as unknown as PropertySutContext<any, any>);

  let clock = 0;
  const now = () => clock++;
  const history: LinearizabilityEntry<EventFromLogic<TLogic>>[] = [];

  async function invoke(event: EventFromLogic<TLogic>): Promise<unknown> {
    const sent = await session.send(event);
    if (sent !== undefined) {
      return projectSut(sent);
    }
    return projectSut(session.read ? await session.read() : undefined);
  }

  try {
    for (const event of options.prefix ?? []) {
      await invoke(event);
    }
    await Promise.all(
      options.branches.map(async (branch, branchIndex) => {
        for (let eventIndex = 0; eventIndex < branch.length; eventIndex++) {
          const event = branch[eventIndex];
          const start = now();
          const response = await invoke(event);
          history.push({
            id: `${branchIndex}:${eventIndex}`,
            actor: `branch-${branchIndex}`,
            invocation: event,
            response,
            start,
            end: now()
          });
        }
      })
    );
  } finally {
    await session.dispose?.();
  }

  let [modelState] = initialTransition(logic, options.input as any);
  for (const event of options.prefix ?? []) {
    [modelState] = transition(logic, modelState, event);
  }

  const result = checkLinearizable<
    SnapshotFrom<TLogic>,
    EventFromLogic<TLogic>
  >(
    history,
    {
      initial: modelState as SnapshotFrom<TLogic>,
      apply: (state, event) => {
        const [next] = transition(logic, state as any, event);
        return {
          state: next as SnapshotFrom<TLogic>,
          response: options.sut.projectModel(next as SnapshotFrom<TLogic>)
        };
      },
      equalResponse: options.equalResponse,
      serializeState: (state) =>
        defaultSerializeState(
          options.sut.projectModel(state as SnapshotFrom<TLogic>)
        )
    },
    { maxExplored: options.maxExplored }
  );

  return { ...result, history };
}
