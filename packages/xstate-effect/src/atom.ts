import { Cause, type Effect } from 'effect';
import { AsyncResult, Atom } from 'effect/unstable/reactivity';
import type {
  Actor,
  ActorOptions,
  AnyActorLogic,
  ErrorFrom,
  EventFromLogic,
  RequiredActorOptionsKeys,
  Snapshot,
  SnapshotFrom
} from 'xstate';
import { createEffectActor } from './createEffectActor.ts';
import { NotReadyError } from './errors.ts';
import type { RequirementsFrom } from './types.ts';

export { NotReadyError } from './errors.ts';

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
   * The snapshot as a result: a `Failure` carrying the actor's error once
   * the actor's status is `error`, so an error boundary can handle it.
   */
  readonly result: Atom.Atom<
    AsyncResult.AsyncResult<SnapshotFrom<TLogic>, ER | ErrorFrom<TLogic>>
  >;
  /**
   * Sends an event to the actor synchronously. Set it with the event, for
   * example through `useAtomSet` in React. Its value reports the last send:
   * a `NotReadyError` failure when the runtime is still building, otherwise
   * success.
   */
  readonly send: Atom.Writable<
    AsyncResult.AsyncResult<void, ER | NotReadyError>,
    EventFromLogic<TLogic>
  >;
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
      const publish = () => {
        get.setSelf(AsyncResult.success(running.getSnapshot()));
      };
      // The atom is the consumer of the actor's error: `result` reports it,
      // so the observer handles `error` and XState does not report it as
      // unhandled.
      const subscription = running.subscribe({
        next: publish,
        error: publish,
        complete: publish
      });
      get.addFinalizer(() => {
        subscription.unsubscribe();
      });
      return AsyncResult.success(running.getSnapshot());
    }
  );

  const result = Atom.make(
    (
      get
    ): AsyncResult.AsyncResult<
      SnapshotFrom<TLogic>,
      ER | ErrorFrom<TLogic>
    > => {
      const current = get(snapshot);
      if (!AsyncResult.isSuccess(current)) {
        return current;
      }
      const value = current.value as Snapshot<unknown>;
      if (value.status === 'error') {
        return AsyncResult.failureWithPrevious(
          Cause.fail(value.error as ErrorFrom<TLogic>),
          { previous: get.self() }
        );
      }
      return current;
    }
  );

  const sendAtom = Atom.writable<
    AsyncResult.AsyncResult<void, ER | NotReadyError>,
    EventFromLogic<TLogic>
  >(
    (get) => AsyncResult.map(get(actor), () => undefined),
    (ctx, event) => {
      const current = ctx.get(actor);
      if (AsyncResult.isInitial(current)) {
        ctx.setSelf(AsyncResult.failure(Cause.fail(new NotReadyError())));
      } else if (AsyncResult.isFailure(current)) {
        ctx.setSelf(AsyncResult.map(current, () => undefined));
      } else {
        current.value.send(event as Parameters<Actor<TLogic>['send']>[0]);
        ctx.setSelf(AsyncResult.success(undefined));
      }
    }
  );

  function select<T>(
    selector: (snapshot: SnapshotFrom<TLogic>) => T
  ): Atom.Atom<AsyncResult.AsyncResult<T, ER>> {
    return Atom.map(snapshot, (result) => AsyncResult.map(result, selector));
  }

  return { actor, snapshot, result, send: sendAtom, select };
}
