import { Effect } from 'effect';
import { AsyncResult, Atom } from 'effect/unstable/reactivity';
import type {
  Actor,
  ActorOptions,
  AnyActorLogic,
  EventFromLogic,
  RequiredActorOptionsKeys,
  SnapshotFrom
} from 'xstate';
import { send } from './actor.ts';
import { createEffectActor } from './createEffectActor.ts';
import type { RequirementsFrom } from './types.ts';

/**
 * Atoms that expose one actor to a reactive UI through
 * `effect/unstable/reactivity`. Read them with the atom bindings for your
 * framework, such as `@effect/atom-react`.
 */
export interface ActorAtoms<TLogic extends AnyActorLogic, ER = never> {
  /**
   * The running actor. It starts when the atom is first read and stops when
   * the atom is released, that is, when nothing reads or mounts it anymore.
   */
  readonly actor: Atom.Atom<AsyncResult.AsyncResult<Actor<TLogic>, ER>>;
  /** The actor's current snapshot, updated on every transition. */
  readonly snapshot: Atom.Atom<
    AsyncResult.AsyncResult<SnapshotFrom<TLogic>, ER>
  >;
  /**
   * Sends an event to the actor. A function atom: set it with the event, for
   * example through `useAtomSet` in React.
   */
  readonly send: Atom.AtomResultFn<EventFromLogic<TLogic>, void, ER>;
  /** Derives an atom of a value selected from the snapshot. */
  readonly select: <T>(
    selector: (snapshot: SnapshotFrom<TLogic>) => T
  ) => Atom.Atom<AsyncResult.AsyncResult<T, ER>>;
}

interface MissingRequirements<T> {
  readonly 'The runtime does not provide services the logic requires': T;
}

/**
 * Creates atoms for an actor that runs in an `Atom.runtime`. The runtime's
 * Layer must provide every service the logic requires; a missing service is
 * a type error on the `runtime` argument.
 *
 * The actor is created with `createEffectActor` inside the `actor` atom's
 * scope, so its lifetime follows the atom: it starts on first read and stops
 * when the atom is released. Wrap the atoms with `Atom.keepAlive` to pin the
 * actor for the registry's lifetime, or with `Atom.family` to create one
 * actor per input.
 */
export function createActorAtoms<TLogic extends AnyActorLogic, R, ER = never>(
  runtime: Atom.AtomRuntime<R, ER> &
    ([RequirementsFrom<TLogic>] extends [R]
      ? unknown
      : MissingRequirements<Exclude<RequirementsFrom<TLogic>, R>>),
  logic: TLogic,
  options?: ActorOptions<TLogic> & {
    [K in RequiredActorOptionsKeys<TLogic>]: unknown;
  }
): ActorAtoms<TLogic, ER> {
  const host = runtime as Atom.AtomRuntime<any, ER>;

  const actor = host.atom(
    createEffectActor(logic, options) as Effect.Effect<Actor<TLogic>, never>
  );

  const snapshot = Atom.make(
    (get): AsyncResult.AsyncResult<SnapshotFrom<TLogic>, ER> => {
      const result = get(actor);
      if (!AsyncResult.isSuccess(result)) {
        return AsyncResult.map(result, (running) => running.getSnapshot());
      }
      const running = result.value;
      const subscription = running.subscribe((next) => {
        get.setSelf(AsyncResult.success(next));
      });
      get.addFinalizer(() => {
        subscription.unsubscribe();
      });
      return AsyncResult.success(running.getSnapshot());
    }
  );

  const sendFn = host.fn<EventFromLogic<TLogic>>()((event, get) =>
    Effect.flatMap(get.result(actor), (running) =>
      send(running, event as Parameters<Actor<TLogic>['send']>[0])
    )
  );

  function select<T>(
    selector: (snapshot: SnapshotFrom<TLogic>) => T
  ): Atom.Atom<AsyncResult.AsyncResult<T, ER>> {
    return Atom.map(snapshot, (result) => AsyncResult.map(result, selector));
  }

  return { actor, snapshot, send: sendFn, select };
}
