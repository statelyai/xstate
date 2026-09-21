import type * as fc from 'fast-check';
import type {
  PropertyReferenceOracle,
  PropertySut,
  PropertySutSession
} from 'xstate/graph';
import type { EventObject, Snapshot } from 'xstate';

let currentScheduler: fc.Scheduler | undefined;

/**
 * The scheduler fast-check generated for the run currently in flight, or
 * `undefined` when the adapter was not configured with `scheduler`.
 *
 * Only defined while a scheduled run is executing, which is exactly when a
 * system under test is created and driven.
 */
export function getCurrentScheduler(): fc.Scheduler | undefined {
  return currentScheduler;
}

/** @internal */
export function withCurrentScheduler<T>(
  scheduler: fc.Scheduler | undefined,
  run: () => Promise<T>
): Promise<T> {
  const previous = currentScheduler;
  currentScheduler = scheduler;
  return run().finally(() => {
    currentScheduler = previous;
  });
}

function scheduleMethod<TArgs extends unknown[], T>(
  scheduler: fc.Scheduler,
  method: ((...args: TArgs) => T | Promise<T>) | undefined
): ((...args: TArgs) => Promise<T>) | undefined {
  if (!method) {
    return undefined;
  }
  return scheduler.scheduleFunction(
    async (...args: TArgs) => await method(...args)
  );
}

/**
 * Wraps a {@link PropertySut} so its asynchronous boundaries (`send`, `read`,
 * `settle`, `advance`) resolve in an order chosen by the run's fast-check
 * scheduler instead of in plain microtask order.
 *
 * The wrapper binds to {@link getCurrentScheduler} when the session is created,
 * so it is inert unless the adapter was configured with `scheduler`.
 */
export function withScheduledSut<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(sut: PropertySut<TSnapshot, TEvent>): PropertySut<TSnapshot, TEvent> {
  return {
    ...sut,
    create: async (context) => {
      const scheduler = getCurrentScheduler();
      const session = await sut.create(context);
      if (!scheduler) {
        return session;
      }
      const send = scheduler.scheduleFunction(
        async (
          event: TEvent,
          sendContext?: Parameters<PropertySutSession<TEvent>['send']>[1]
        ) => await session.send(event, sendContext)
      );
      const read = scheduler.scheduleFunction(async () => await session.read());
      const settle = scheduleMethod(scheduler, session.settle?.bind(session));
      const advance = scheduleMethod(scheduler, session.advance?.bind(session));
      return {
        ...session,
        send: (event, sendContext) => send(event, sendContext),
        read: () => read(),
        ...(settle ? { settle: () => settle() } : {}),
        ...(advance
          ? { advance: (milliseconds: number) => advance(milliseconds) }
          : {})
      };
    }
  };
}

/**
 * Wraps a reference oracle the way {@link withScheduledSut} wraps a system
 * under test: its `transition` and `read` calls resolve under the run's
 * scheduler.
 */
export function withScheduledReference<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(
  reference: PropertyReferenceOracle<TSnapshot, TEvent>
): PropertyReferenceOracle<TSnapshot, TEvent> {
  return {
    ...reference,
    create: async (context) => {
      const scheduler = getCurrentScheduler();
      const session = await reference.create(context);
      if (!scheduler) {
        return session;
      }
      const step = scheduler.scheduleFunction(
        async (event: TEvent) => await session.transition(event)
      );
      const read = scheduler.scheduleFunction(async () => await session.read());
      return {
        ...session,
        transition: (event) => step(event),
        read: () => read()
      };
    }
  };
}
