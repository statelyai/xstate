import {
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

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

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
    const actorRuntime = {
      spawnActor: (_source: AnyActor | undefined, actor: AnyActor) => {
        operations.push({ type: 'actor.spawn' as const, actorId: actor.id });
        Object.assign(actor.system, actorRuntime);
      },
      startActor: (actor: AnyActor) => {
        operations.push({ type: 'actor.start' as const, actorId: actor.id });
        actor.start();
      },
      stopActor: (actor: AnyActor) => {
        operations.push({ type: 'actor.stop' as const, actorId: actor.id });
        (actor as AnyActor & { _stop(): void })._stop();
      },
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
        if (target._parent) {
          target._send(event);
        } else {
          enqueue(event);
        }
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
      executeAction: async (action) => {
        operations.push({ type: 'action', actionType: action.type });
        await action.exec();
      },
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

    const result = (async () => {
      let effects;
      [snapshot, effects] = durable.initialTransition(input as never);
      await durable.executeEffects(effects);

      while ((snapshot as Snapshot<unknown>).status === 'active') {
        const event = await durable.waitForEvent();
        [snapshot, effects] = durable.transition(snapshot, event);
        await durable.executeEffects(effects);
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
          actorRuntime.sendEvent(timer.source, timer.source, {
            type: 'xstate.timer',
            id: timer.id
          });
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
