import { Cause, Duration, Effect, Queue, Stream } from 'effect';
import { dual } from 'effect/Function';
import type {
  Actor,
  ActorRef,
  AnyActor,
  AnyActorRef,
  AnyEventObject,
  DeadLetterInspectionEvent,
  EmittedFrom,
  ErrorFrom,
  InspectionEvent,
  OutputFrom,
  Snapshot,
  SnapshotFrom,
  Subscription
} from 'xstate';
import { ActorStoppedError } from './errors.ts';

/** The event type accepted by an actor's `send` method. */
export type SendableEventFrom<TActor extends AnyActorRef> = Parameters<
  TActor['send']
>[0];

/** The event type an actor emits through `actor.on(...)`. */
export type EmittedEventFrom<TActor> =
  TActor extends Actor<infer TLogic>
    ? EmittedFrom<TLogic>
    : TActor extends ActorRef<any, any, infer TEmitted, any>
      ? TEmitted
      : AnyEventObject;

/** Options for {@link waitFor}. */
export interface WaitForOptions {
  /**
   * Fails with `Cause.TimeoutError` when no snapshot satisfies the predicate
   * within this duration.
   */
  readonly timeout: Duration.Input;
}

const noopSubscription: Subscription = { unsubscribe: () => {} };

function actorId(actor: AnyActorRef): string {
  return (actor as Partial<AnyActor>).id ?? '(unknown)';
}

function stoppedError(actor: AnyActorRef): ActorStoppedError {
  return new ActorStoppedError({
    actorId: actorId(actor),
    snapshot: actor.getSnapshot()
  });
}

function isActorRef(value: unknown): value is AnyActorRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AnyActorRef).send === 'function' &&
    typeof (value as AnyActorRef).getSnapshot === 'function'
  );
}

/**
 * Sends an event to an actor. The returned Effect always succeeds: delivery
 * is synchronous, like `actor.send(event)`, and an event that cannot be
 * delivered (for example to a stopped actor) is reported as a dead letter,
 * observable with {@link deadLetters}.
 */
export const send: {
  <TActor extends AnyActorRef>(
    event: SendableEventFrom<TActor>
  ): (actor: TActor) => Effect.Effect<void>;
  <TActor extends AnyActorRef>(
    actor: TActor,
    event: SendableEventFrom<TActor>
  ): Effect.Effect<void>;
} = dual(
  2,
  <TActor extends AnyActorRef>(
    actor: TActor,
    event: SendableEventFrom<TActor>
  ): Effect.Effect<void> =>
    Effect.sync(() => {
      actor.send(event);
    })
);

/**
 * Streams an actor's snapshots, starting with the current one. The stream ends
 * when the actor completes or stops, and emits the error snapshot before
 * ending when the actor errors. Interrupting the stream unsubscribes from the
 * actor.
 */
export function snapshots<TActor extends AnyActorRef>(
  actor: TActor
): Stream.Stream<SnapshotFrom<TActor>> {
  return Stream.callback<SnapshotFrom<TActor>>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const current = actor.getSnapshot();
        Queue.offerUnsafe(queue, current);

        if (current.status !== 'active') {
          Queue.endUnsafe(queue);
          return noopSubscription;
        }

        return actor.subscribe({
          next: (snapshot) => {
            Queue.offerUnsafe(queue, snapshot);
          },
          error: () => {
            Queue.offerUnsafe(queue, actor.getSnapshot());
            Queue.endUnsafe(queue);
          },
          complete: () => {
            Queue.endUnsafe(queue);
          }
        }) as Subscription;
      }),
      (subscription) =>
        Effect.sync(() => {
          subscription.unsubscribe();
        })
    )
  );
}

/**
 * Streams every event an actor emits, as delivered to `actor.on('*', …)`. The
 * stream ends when the actor completes, errors or stops. Interrupting the
 * stream removes the listener.
 */
export function emitted<TActor extends AnyActorRef>(
  actor: TActor
): Stream.Stream<EmittedEventFrom<TActor>> {
  return Stream.callback<EmittedEventFrom<TActor>>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const listener = actor.on('*', (event) => {
          Queue.offerUnsafe(queue, event as EmittedEventFrom<TActor>);
        });

        if (actor.getSnapshot().status !== 'active') {
          Queue.endUnsafe(queue);
          return [listener, noopSubscription] as const;
        }

        const subscription = actor.subscribe({
          error: () => {
            Queue.endUnsafe(queue);
          },
          complete: () => {
            Queue.endUnsafe(queue);
          }
        }) as Subscription;

        return [listener, subscription] as const;
      }),
      ([listener, subscription]) =>
        Effect.sync(() => {
          listener.unsubscribe();
          subscription.unsubscribe();
        })
    )
  );
}

/**
 * Waits for the first actor snapshot that satisfies `predicate`, succeeding
 * immediately when the current snapshot already does. Fails with
 * `ActorStoppedError` if the actor stops or errors first, and with
 * `Cause.TimeoutError` when `options.timeout` elapses. Interrupting the Effect
 * unsubscribes from the actor.
 */
export const waitFor: {
  <TActor extends AnyActorRef, TNarrowed extends SnapshotFrom<TActor>>(
    predicate: (snapshot: SnapshotFrom<TActor>) => snapshot is TNarrowed
  ): (actor: TActor) => Effect.Effect<TNarrowed, ActorStoppedError>;
  <TActor extends AnyActorRef>(
    predicate: (snapshot: SnapshotFrom<TActor>) => boolean
  ): (actor: TActor) => Effect.Effect<SnapshotFrom<TActor>, ActorStoppedError>;
  <TActor extends AnyActorRef, TNarrowed extends SnapshotFrom<TActor>>(
    predicate: (snapshot: SnapshotFrom<TActor>) => snapshot is TNarrowed,
    options: WaitForOptions
  ): (
    actor: TActor
  ) => Effect.Effect<TNarrowed, ActorStoppedError | Cause.TimeoutError>;
  <TActor extends AnyActorRef>(
    predicate: (snapshot: SnapshotFrom<TActor>) => boolean,
    options: WaitForOptions
  ): (
    actor: TActor
  ) => Effect.Effect<
    SnapshotFrom<TActor>,
    ActorStoppedError | Cause.TimeoutError
  >;
  <TActor extends AnyActorRef, TNarrowed extends SnapshotFrom<TActor>>(
    actor: TActor,
    predicate: (snapshot: SnapshotFrom<TActor>) => snapshot is TNarrowed
  ): Effect.Effect<TNarrowed, ActorStoppedError>;
  <TActor extends AnyActorRef>(
    actor: TActor,
    predicate: (snapshot: SnapshotFrom<TActor>) => boolean
  ): Effect.Effect<SnapshotFrom<TActor>, ActorStoppedError>;
  <TActor extends AnyActorRef, TNarrowed extends SnapshotFrom<TActor>>(
    actor: TActor,
    predicate: (snapshot: SnapshotFrom<TActor>) => snapshot is TNarrowed,
    options: WaitForOptions
  ): Effect.Effect<TNarrowed, ActorStoppedError | Cause.TimeoutError>;
  <TActor extends AnyActorRef>(
    actor: TActor,
    predicate: (snapshot: SnapshotFrom<TActor>) => boolean,
    options: WaitForOptions
  ): Effect.Effect<
    SnapshotFrom<TActor>,
    ActorStoppedError | Cause.TimeoutError
  >;
} = dual(
  (args) => isActorRef(args[0]),
  <TActor extends AnyActorRef>(
    actor: TActor,
    predicate: (snapshot: SnapshotFrom<TActor>) => boolean,
    options?: WaitForOptions
  ): Effect.Effect<
    SnapshotFrom<TActor>,
    ActorStoppedError | Cause.TimeoutError
  > => {
    const waiting = Effect.callback<SnapshotFrom<TActor>, ActorStoppedError>(
      (resume) => {
        const current: Snapshot<unknown> = actor.getSnapshot();

        if (predicate(current as SnapshotFrom<TActor>)) {
          resume(Effect.succeed(current as SnapshotFrom<TActor>));
          return;
        }

        if (current.status !== 'active') {
          resume(Effect.fail(stoppedError(actor)));
          return;
        }

        let settled = false;
        // oxlint-disable-next-line prefer-const
        let subscription: Subscription | undefined; // avoid TDZ when settling synchronously
        const dispose = () => {
          settled = true;
          subscription?.unsubscribe();
        };

        subscription = actor.subscribe({
          next: (snapshot: SnapshotFrom<TActor>) => {
            if (settled || !predicate(snapshot)) {
              return;
            }
            dispose();
            resume(Effect.succeed(snapshot));
          },
          error: () => {
            if (settled) {
              return;
            }
            dispose();
            resume(Effect.fail(stoppedError(actor)));
          },
          complete: () => {
            if (settled) {
              return;
            }
            dispose();
            resume(Effect.fail(stoppedError(actor)));
          }
        }) as Subscription;

        if (settled) {
          subscription.unsubscribe();
        }

        return Effect.sync(dispose);
      }
    );

    return options === undefined
      ? waiting
      : Effect.timeout(waiting, options.timeout);
  }
);

/**
 * Joins an actor's final result, like `Fiber.join`: succeeds with its `output`
 * when it is done, fails with `snapshot.error` when it errors, and fails with
 * `ActorStoppedError` when it stops without output. Waits for a still-active
 * actor to settle.
 */
export function join<TActor extends AnyActorRef>(
  actor: TActor
): Effect.Effect<OutputFrom<TActor>, ErrorFrom<TActor> | ActorStoppedError> {
  return Effect.callback<
    OutputFrom<TActor>,
    ErrorFrom<TActor> | ActorStoppedError
  >((resume) => {
    const settle = () => {
      const snapshot = actor.getSnapshot();
      if (snapshot.status === 'done') {
        resume(Effect.succeed(snapshot.output as OutputFrom<TActor>));
      } else if (snapshot.status === 'error') {
        resume(Effect.fail(snapshot.error as ErrorFrom<TActor>));
      } else {
        resume(Effect.fail(stoppedError(actor)));
      }
    };

    if (actor.getSnapshot().status !== 'active') {
      settle();
      return;
    }

    let settled = false;
    // oxlint-disable-next-line prefer-const
    let subscription: Subscription | undefined; // avoid TDZ when settling synchronously
    const dispose = () => {
      settled = true;
      subscription?.unsubscribe();
    };
    const onSettled = () => {
      if (settled) {
        return;
      }
      dispose();
      settle();
    };

    subscription = actor.subscribe({
      error: onSettled,
      complete: onSettled
    }) as Subscription;

    if (settled) {
      subscription.unsubscribe();
    }

    return Effect.sync(dispose);
  });
}

/**
 * Streams the inspection events of the actor's system, as delivered to
 * `system.inspect(…)`. The stream runs until it is interrupted or its scope
 * closes.
 */
export function inspect(actor: AnyActorRef): Stream.Stream<InspectionEvent> {
  return Stream.callback<InspectionEvent>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() =>
        (actor as unknown as AnyActor).system.inspect(
          (inspectionEvent: InspectionEvent) => {
            Queue.offerUnsafe(queue, inspectionEvent);
          }
        )
      ),
      (subscription) =>
        Effect.sync(() => {
          subscription.unsubscribe();
        })
    )
  );
}

/**
 * Streams the events the actor's system could not deliver: sends to a
 * stopped actor, invalid external events and internal events sent from
 * outside their owner. A dead letter is not an actor error. The stream runs
 * until it is interrupted or its scope closes.
 */
export function deadLetters(
  actor: AnyActorRef
): Stream.Stream<DeadLetterInspectionEvent> {
  return Stream.filter(
    inspect(actor),
    (event): event is DeadLetterInspectionEvent =>
      event.type === '@xstate.deadletter'
  );
}
