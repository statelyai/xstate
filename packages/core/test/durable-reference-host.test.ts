import {
  deliverEvent,
  stopActor,
  terminateActor,
  type AnyActor,
  type AnyActorLogic,
  type Snapshot
} from '../src/index.ts';
import {
  DurableExecutionCancelledError,
  createDurable
} from '../src/durable/index.ts';
import {
  type DurableConformanceExecution,
  type DurableConformanceHarness,
  type DurableConformanceOperation,
  durableExecutionConformance
} from './durable-conformance.ts';

interface PendingTimer {
  source: AnyActor;
  id: string;
  dueAt: number;
}

// Effects now settle over an async handoff tail spanning several microtasks,
// so quiescence needs a macrotask boundary, not a single microtask.
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

class InMemoryDurableHost implements DurableConformanceHarness {
  async start<TLogic extends AnyActorLogic>(
    logic: TLogic,
    input?: unknown
  ): Promise<DurableConformanceExecution<TLogic>> {
    let now = 0;
    let snapshot: any;
    const inbox: any[] = [];
    const waiters: Array<(event: any) => void> = [];
    const timers = new Map<string, PendingTimer>();
    const operations: DurableConformanceOperation[] = [];
    let markReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      markReady = resolve;
    });

    const enqueue = (event: any) => {
      const waiter = waiters.shift();
      if (waiter) {
        waiter(event);
      } else {
        inbox.push(event);
      }
    };
    const timerKey = (source: AnyActor, id: string) =>
      `${source.sessionId}:${id}`;
    let rootAddress: string | undefined;
    const actorRuntime = {
      spawnActor: (_source: AnyActor | undefined, actor: AnyActor) => {
        operations.push({ type: 'actor.spawn' as const, actorId: actor.id });
      },
      startActor: (actor: AnyActor) => {
        operations.push({ type: 'actor.start' as const, actorId: actor.id });
        actor.start();
      },
      stopActor: (actor: AnyActor) => {
        operations.push({ type: 'actor.stop' as const, actorId: actor.id });
        stopActor(actor);
      },
      terminateActor: (actor: AnyActor, termination: any) => {
        // Child actors complete locally; the root's terminal effect is
        // recorded through the per-effect runtime instead.
        terminateActor(actor, termination);
      },
      // Root-bound events do not reach sendEvent during executeEffects; the
      // execution captures them and returns them from that call. They only
      // arrive here when the loop is parked, in which case the host enqueues
      // them in its own inbox like any other external message.
      sendEvent: (
        source: AnyActor | undefined,
        target: AnyActor,
        event: any
      ) => {
        operations.push({
          type: 'event.send' as const,
          sourceId: source?.id,
          targetId: target.id,
          eventType: event.type
        });
        if (target.address === rootAddress) {
          enqueue(event);
          return;
        }
        deliverEvent(source, target, event);
      },
      emitEvent: () => {},
      scheduleTimer: (source: AnyActor, id: string, delay: number) => {
        operations.push({
          type: 'timer.schedule' as const,
          actorId: source.id,
          id,
          delay
        });
        timers.set(timerKey(source, id), {
          source,
          id,
          dueAt: now + delay
        });
      },
      cancelTimer: (source: AnyActor, id: string) => {
        operations.push({
          type: 'timer.cancel' as const,
          actorId: source.id,
          id
        });
        timers.delete(timerKey(source, id));
      },
      cancelAllTimers: (source: AnyActor) => {
        for (const [key, timer] of timers) {
          if (timer.source === source) {
            timers.delete(key);
          }
        }
      }
    };
    const durable = createDurable(logic, {
      executeAction: async (action, _metadata, runtime) => {
        operations.push({ type: 'action', actionType: action.type });
        await action.exec(runtime);
      },
      ...actorRuntime,
      runtime: () => ({
        ...actorRuntime,
        terminateActor: (actor, termination) => {
          operations.push({
            type: 'actor.terminate',
            actorId: actor.id,
            status: termination.status
          });
        }
      }),
      waitForEvent: () => {
        const event = inbox.shift();
        if (event) {
          return event;
        }
        markReady();
        return new Promise((resolve) => waiters.push(resolve));
      }
    });

    const rootId = () => durable.rootAddress;
    const enqueueRootEvents = (
      rootEvents: Awaited<ReturnType<typeof durable.executeEffects>>
    ) => {
      for (const { event, source } of rootEvents) {
        operations.push({
          type: 'event.send' as const,
          sourceId: source?.id,
          targetId: rootId(),
          eventType: event.type
        });
        enqueue(event);
      }
    };

    const result = (async () => {
      let effects;
      [snapshot, effects] = durable.initialTransition(input as never);
      rootAddress = durable.getActorRef(snapshot)?.address;
      enqueueRootEvents(await durable.executeEffects(effects));

      while ((snapshot as Snapshot<unknown>).status === 'active') {
        const event = await durable.waitForEvent();
        [snapshot, effects] = durable.transition(snapshot, event);
        enqueueRootEvents(await durable.executeEffects(effects));
      }

      const terminal = snapshot as Snapshot<unknown>;
      if (terminal.status === 'done') {
        return terminal.output;
      }
      if (terminal.status === 'error') {
        throw terminal.error;
      }
      throw new DurableExecutionCancelledError();
    })();
    void result.catch(() => {});
    void result.finally(markReady).catch(() => {});
    await ready;

    return {
      result,
      operations,
      async send(event) {
        enqueue(event);
        await flush();
      },
      async advanceTime(ms) {
        now += ms;
        while (true) {
          const due = [...timers.entries()]
            .filter(([, timer]) => timer.dueAt <= now)
            .sort(([, a], [, b]) => a.dueAt - b.dueAt)[0];
          if (!due) {
            break;
          }
          const [key, timer] = due;
          timers.delete(key);
          const timerEvent = { type: 'xstate.timer', id: timer.id };
          if (timer.source.address === rootAddress) {
            // Fired root timers are external mailbox events.
            enqueue(timerEvent);
          } else {
            actorRuntime.sendEvent(timer.source, timer.source, timerEvent);
          }
          await flush();
        }
      },
      getSnapshot() {
        return snapshot;
      }
    } as DurableConformanceExecution<TLogic>;
  }
}

durableExecutionConformance({
  name: 'in-memory reference host',
  createHarness: () => new InMemoryDurableHost(),
  capabilities: new Set([
    'actions',
    'timers',
    'actors',
    'actorCommunication',
    'mailbox',
    'errors',
    'output'
  ])
});
