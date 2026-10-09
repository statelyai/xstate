import {
  Clock,
  Context,
  Duration,
  Effect,
  Exit,
  Fiber,
  Queue,
  Scope
} from 'effect';
import {
  deliverEvent,
  isMachineSnapshot,
  stopActor,
  terminateActor,
  type ActorOptions,
  type AnyActor,
  type AnyActorLogic,
  type AnyEventObject,
  type EventFromLogic,
  type InspectionEvent,
  type InputFrom,
  type RequiredActorOptionsFor,
  type RequiredActorOptionsKeys,
  type Snapshot,
  type SnapshotFrom
} from 'xstate';
import { createDurable, type DurableEffect } from 'xstate/durable';
import {
  EffectActor,
  actionFailure,
  isActionFailure,
  safeCall,
  type MailboxItem
} from './effectActor.ts';
import {
  bindEffectHost,
  closeEffectHost,
  createEffectHost,
  withEffectHost,
  type EffectHost
} from './internal.ts';
import type { RequirementsFrom } from './types.ts';
import { ActorScope } from './actorScope.ts';

const XSTATE_TIMER = 'xstate.timer';
const XSTATE_INIT = '@xstate.init';

/** Options for {@link createEffectActor}. */
export type EffectActorOptions<TLogic extends AnyActorLogic> = {
  readonly input?: InputFrom<TLogic>;
  /**
   * A snapshot from `actor.getPersistedSnapshot()`. The actor resumes in that
   * state without re-running entry actions, and pending timers keep their
   * original deadlines, as with XState's `createActor(logic, { snapshot })`.
   * State-machine children resume their persisted state and completed
   * children stay done. Effect tasks and streams that were running, at the
   * root or as children, start again from the beginning. A restored actor
   * does not need `input`.
   */
  readonly snapshot?: ActorOptions<TLogic>['snapshot'];
} & RequiredActorOptionsFor<TLogic>;

export type EffectActorOptionsArgs<TLogic extends AnyActorLogic> = [
  RequiredActorOptionsKeys<TLogic>
] extends [never]
  ? [options?: EffectActorOptions<TLogic>]
  : [options: EffectActorOptions<TLogic>];

/**
 * Creates and starts an actor as an Effect interpreter over pure transitions.
 *
 * Each step is `transition(snapshot, event)`, a pure function that returns
 * the next snapshot and the actions to run. An Effect fiber owns the loop:
 * the mailbox is a `Queue`, timers are `Effect.sleep` fibers on the Effect
 * `Clock`, and declared Effect actions run as forked Effects in the actor's
 * `Scope` with the services captured here. Child actors are started as live
 * XState actors whose Effects run in the same host.
 *
 * The actor is a scoped resource: it stops, and every Effect it hosts is
 * interrupted, when the enclosing `Scope` closes. The returned Effect never
 * fails; the actor's own outcome is its snapshot status, read with `join`.
 */
export function createEffectActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: EffectActorOptionsArgs<TLogic>
): Effect.Effect<
  EffectActor<TLogic>,
  never,
  RequirementsFrom<TLogic> | Scope.Scope
> {
  return Effect.acquireRelease(
    Effect.gen(function* () {
      const parentScope = yield* Effect.scope;
      const actorScope = yield* Scope.fork(parentScope);
      const baseContext = yield* Effect.context<never>();
      const context = Context.add(
        Context.add(baseContext, Scope.Scope, actorScope),
        ActorScope,
        actorScope
      );
      const host = createEffectHost(context, actorScope);
      const runFork = Effect.runForkWith(context);
      const runPromise = Effect.runPromiseWith(context);

      const mailbox =
        yield* Queue.unbounded<MailboxItem<EventFromLogic<TLogic>>>();
      const timers = new Map<string, Fiber.Fiber<void>>();
      // `root` and `actor` are declared after the adapter below; its
      // callbacks only run once they are initialized.
      let stopped = false;
      const isRoot = (candidate: AnyActor) =>
        candidate.address === durable.rootAddress;

      const offer = (item: MailboxItem<EventFromLogic<TLogic>>) => {
        if (!stopped) {
          Queue.offerUnsafe(mailbox, item);
        }
      };
      const timerKey = (source: AnyActor, id: string) =>
        `${source.sessionId}:${id}`;

      const inspectors = new Set<(event: InspectionEvent) => void>();
      let rootAnnounced = false;
      const clock = Context.get(context, Clock.Clock);
      const durable = createDurable(
        logic,
        {
          // Timer deadlines are measured on the same clock the timers sleep
          // on, so a restored timer resumes with its remaining delay.
          now: () => clock.currentTimeMillisUnsafe(),
          executeAction: (action, _metadata, runtime) => {
            // Fire-and-forget: the action starts now and the loop continues.
            // A rejection reaches the machine as an execution error.
            try {
              const result = withEffectHost(host, () => action.exec(runtime));
              if (
                result &&
                typeof (result as PromiseLike<unknown>).then === 'function'
              ) {
                void Promise.resolve(result).catch((error: unknown) => {
                  offer({ [actionFailure]: true, error });
                });
              }
            } catch (error) {
              offer({ [actionFailure]: true, error });
            }
          },
          spawnActor: (_source, child) => {
            // Every actor of this execution hosts its Effects here.
            bindEffectHost(child, host);
          },
          startActor: (child) => {
            child.start();
          },
          stopActor: (child) => {
            if (!isRoot(child)) {
              stopActor(child);
            }
          },
          terminateActor: (child, termination) => {
            if (!isRoot(child)) {
              terminateActor(child, termination);
            }
          },
          sendEvent: (source, target, event) => {
            if (isRoot(target)) {
              offer(event as EventFromLogic<TLogic>);
              return;
            }
            deliverEvent(source, target, event);
          },
          emitEvent: (source, event) => {
            if (isRoot(source)) {
              actor._emit(event as never);
              return;
            }
            (source as AnyActor & { _emit(value: unknown): void })._emit(event);
          },
          scheduleTimer: (source, id, delay) => {
            const key = timerKey(source, id);
            timers.get(key)?.interruptUnsafe();
            const fiber = Fiber.runIn(
              runFork(
                Effect.andThen(
                  Effect.sleep(Duration.millis(delay)),
                  Effect.sync(() => {
                    timers.delete(key);
                    const timerEvent: AnyEventObject = {
                      type: XSTATE_TIMER,
                      id
                    };
                    if (isRoot(source)) {
                      offer(timerEvent as EventFromLogic<TLogic>);
                    } else {
                      deliverEvent(source, source, timerEvent);
                    }
                  })
                )
              ),
              actorScope
            );
            timers.set(key, fiber);
          },
          cancelTimer: (source, id) => {
            const key = timerKey(source, id);
            timers.get(key)?.interruptUnsafe();
            timers.delete(key);
          },
          cancelAllTimers: (source) => {
            for (const [key, fiber] of timers) {
              if (key.startsWith(`${source.sessionId}:`)) {
                fiber.interruptUnsafe();
                timers.delete(key);
              }
            }
          },
          waitForEvent: () =>
            runPromise(Queue.take(mailbox)) as Promise<EventFromLogic<TLogic>>
        },
        {
          inspect: (event) => {
            // The pure step scope re-materializes the root ref per step and
            // announces it again; observers should see the root once.
            if (
              event.type === '@xstate.actor' &&
              (event.actorRef as AnyActor).address === durable.rootAddress
            ) {
              if (rootAnnounced) {
                return;
              }
              rootAnnounced = true;
            }
            for (const inspector of inspectors) {
              safeCall(inspector, event);
            }
          }
        }
      );

      const errorSnapshot = (
        snapshot: SnapshotFrom<TLogic>,
        error: unknown
      ): SnapshotFrom<TLogic> =>
        ({
          ...(snapshot as Snapshot<unknown>),
          status: 'error',
          error
        }) as SnapshotFrom<TLogic>;

      const stopChildren = (snapshot: SnapshotFrom<TLogic>) => {
        const children = (
          snapshot as { children?: Record<string, AnyActor | undefined> }
        ).children;
        for (const child of Object.values(children ?? {})) {
          if (child && !isRoot(child)) {
            stopActor(child);
          }
        }
      };

      const stop = () => {
        if (stopped) {
          return;
        }
        stopped = true;
        for (const fiber of timers.values()) {
          fiber.interruptUnsafe();
        }
        timers.clear();
        const current = actor.getSnapshot();
        if (current) {
          stopChildren(current);
        }
        runFork(Queue.shutdown(mailbox));
        if (!actor._isSettled) {
          actor._settle({
            ...(actor.getSnapshot() as Snapshot<unknown>),
            status: 'stopped'
          } as SnapshotFrom<TLogic>);
        }
        closeEffectHost(host);
      };

      // The first transition (or the restore) runs here so the handle is
      // ready when this Effect succeeds, and the initial actions start before
      // any send. Restoring runs no entry actions; its effects resume
      // machine children, restart running Effect children and re-arm pending
      // timers.
      let [snapshot, effects] = options?.snapshot
        ? durable.restore(options.snapshot)
        : durable.initialTransition(options?.input as never);
      const initial: Snapshot<unknown> = snapshot;
      if (
        options?.snapshot &&
        !isMachineSnapshot(initial) &&
        initial.status === 'active'
      ) {
        // A restored machine resumes through the effects above. Other logic
        // (an Effect task or stream at the root) reattaches its active work by
        // replaying its init event, as its restored `start` does under
        // `createActor`.
        const [started, startEffects] = durable.transition(snapshot, {
          type: XSTATE_INIT,
          input: 'input' in initial ? initial.input : undefined
        } as EventFromLogic<TLogic>);
        snapshot = started;
        effects = [...effects, ...startEffects];
      }
      const root = durable.getActorRef(snapshot)!;
      // Restored children are created by the snapshot, not spawned through
      // the adapter; they find this host through their parent chain.
      bindEffectHost(root, host);
      // The root exists from here on; later announcements are step
      // re-materializations, not new actors.
      rootAnnounced = true;
      const actor = new EffectActor(
        logic,
        root!,
        snapshot,
        mailbox,
        stop,
        inspectors
      );
      bindEffectHost(actor, host);

      const executeEffects = (
        batch: DurableEffect<any>[]
      ): Effect.Effect<void> =>
        Effect.promise(() =>
          durable.executeEffects(batch).then(
            () => undefined,
            (error: unknown) => {
              offer({ [actionFailure]: true, error });
            }
          )
        );

      const loop = Effect.gen(function* () {
        yield* executeEffects(effects);
        while (
          (snapshot as Snapshot<unknown>).status === 'active' &&
          !stopped
        ) {
          const item = yield* Effect.promise(() =>
            durable.waitForEvent().then(
              (event) => event as MailboxItem<EventFromLogic<TLogic>>,
              () => undefined
            )
          );
          if (item === undefined || stopped) {
            break;
          }
          let event: EventFromLogic<TLogic>;
          if (isActionFailure(item)) {
            const errorEvent = (
              logic as {
                getExecutionErrorEvent?: (
                  snapshot: SnapshotFrom<TLogic>,
                  error: unknown
                ) => EventFromLogic<TLogic> | undefined;
              }
            ).getExecutionErrorEvent?.(snapshot, item.error);
            if (!errorEvent) {
              snapshot = errorSnapshot(snapshot, item.error);
              break;
            }
            event = errorEvent;
          } else {
            event = item;
          }
          try {
            [snapshot, effects] = durable.transition(snapshot, event);
          } catch (error) {
            snapshot = errorSnapshot(snapshot, error);
            break;
          }
          actor._publish(snapshot);
          yield* executeEffects(effects);
        }
        if (!stopped) {
          actor._publish(snapshot);
          if ((snapshot as Snapshot<unknown>).status !== 'active') {
            stopChildren(snapshot);
            closeEffectHost(host);
          }
        }
      });

      yield* Effect.forkIn(loop, actorScope);
      return { actor, host };
    }),
    ({ actor, host }: { actor: EffectActor<TLogic>; host: EffectHost }) =>
      Effect.gen(function* () {
        actor.stop();
        if (host.closing) {
          yield* Fiber.join(host.closing);
        } else {
          yield* Scope.close(host.scope, Exit.void);
        }
      })
  ).pipe(Effect.map(({ actor }) => actor)) as unknown as Effect.Effect<
    EffectActor<TLogic>,
    never,
    RequirementsFrom<TLogic> | Scope.Scope
  >;
}
