import {
  deliverEvent,
  type AnyActor,
  type AnyActorLogic,
  type AnyEventObject
} from 'xstate';
import { createDurable } from 'xstate/durable';

/**
 * A minimal in-memory durable host: a journal keyed by effect ID, a mailbox
 * for events addressed to the root actor, and timers the host owns.
 *
 * A real host (Temporal, Restate, Inngest, …) swaps the journal for its own
 * durable log and `waitForEvent` for its own durable wait. The contract is
 * the same: memoize each operation by its stable ID, re-run everything else.
 */
export interface Journal {
  /** Recorded results, keyed by effect ID or actor address. */
  entries: Map<string, unknown>;
  /** Keys handed to the host, in order: the replay fingerprint. */
  keys: string[];
  /** Keys whose body actually ran, rather than replaying from the journal. */
  executed: string[];
}

export const createJournal = (): Journal => ({
  entries: new Map(),
  keys: [],
  executed: []
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

export async function runOnHost<TLogic extends AnyActorLogic>(options: {
  logic: TLogic;
  executionId: string;
  journal: Journal;
  /** External events the host's mailbox hands to the execution, in order. */
  events: readonly AnyEventObject[];
  resume?: { snapshot: any; transitionIndex: number };
  /** Simulate a crash once this many transitions have run. */
  crashAfterTransitions?: number;
  log: (message: string) => void;
}) {
  const { logic, journal, resume, log } = options;
  const machine = logic as any;
  const mailbox: AnyEventObject[] = [...options.events];
  const timers = new Map<string, { source: AnyActor; id: string }>();
  const pendingLogic = new Set<Promise<unknown>>();
  let rootAddress: string | undefined;

  const journaled = async <T>(key: string, exec: () => PromiseLike<T>) => {
    journal.keys.push(key);
    if (journal.entries.has(key)) {
      log(`  journal hit   ${key} — not re-run`);
      return journal.entries.get(key) as T;
    }
    journal.executed.push(key);
    log(`  journal write ${key}`);
    const result = await exec();
    journal.entries.set(key, result);
    return result;
  };

  const runtime = {
    sendEvent: (
      source: AnyActor | undefined,
      target: AnyActor,
      event: AnyEventObject
    ) => {
      // While the loop is parked, root-addressed events belong in the host's
      // own mailbox; everything else is delivered locally.
      if (target.address === rootAddress) {
        mailbox.push(event);
        return;
      }
      deliverEvent(source, target, event);
    },
    scheduleTimer: (source: AnyActor, id: string, delay: number) => {
      log(`  host: schedule timer ${id} (+${delay}ms)`);
      timers.set(`${source.address}#${id}`, { source, id });
    },
    cancelTimer: (source: AnyActor, id: string) => {
      timers.delete(`${source.address}#${id}`);
    },
    // An invoked actor is the primary durable unit: its whole body is one
    // journal entry, keyed by its stable address.
    runLogic: (actor: AnyActor, exec: () => PromiseLike<unknown>) => {
      const promise = journaled(`logic:${actor.address}`, exec);
      pendingLogic.add(promise);
      void promise.finally(() => pendingLogic.delete(promise));
      return promise;
    }
  };

  /** The host's durable wait: mailbox first, then the next pending timer. */
  const nextEvent = async (): Promise<any> => {
    // Logic bodies outlive `executeEffects`, so a host that parks here lets
    // them settle first — otherwise it waits for an event only their
    // completion can produce.
    if (!mailbox.length && pendingLogic.size) {
      await Promise.all(pendingLogic);
    }
    if (!mailbox.length) {
      await flush();
    }
    const event = mailbox.shift();
    if (event) {
      return event;
    }
    const next = timers.entries().next();
    if (next.done) {
      throw new Error('the host ran out of events');
    }
    const [key, timer] = next.value;
    timers.delete(key);
    log(`  host: firing timer ${timer.id}`);
    const timerEvent = { type: 'xstate.timer', id: timer.id };
    if (timer.source.address === rootAddress) {
      return timerEvent;
    }
    runtime.sendEvent(timer.source, timer.source, timerEvent);
    return nextEvent();
  };

  const durable = createDurable(logic, {
    ...runtime,
    // Pinning the execution id makes session ids a deterministic function of
    // actor-creation order, so a replay re-creates the same ids.
    executionId: options.executionId,
    transitionIndex: resume?.transitionIndex,
    executeAction: (action, metadata, actionRuntime) =>
      journaled(`${metadata.id} (${action.type})`, async () => {
        await action.exec(actionRuntime);
        return true;
      }).then(() => undefined),
    waitForEvent: () => nextEvent()
  });

  const checkpoint = (snapshot: any) => ({
    snapshot: machine.getPersistedSnapshot(snapshot),
    transitionIndex: durable.nextTransitionIndex
  });

  let transitions = 0;
  let snapshot: any;
  let effects;

  if (resume) {
    snapshot = machine.restoreSnapshot(resume.snapshot);
    rootAddress = durable.getActorRef(snapshot)?.address;
    // Timers belong to the host, so it re-arms the ones the checkpoint
    // recorded as pending; XState does not reschedule them on a durable host.
    for (const timer of Object.values(
      (resume.snapshot.timers ?? {}) as Record<string, { id: string }>
    )) {
      log(`  host: re-arming checkpointed timer ${timer.id}`);
      timers.set(`${rootAddress}#${timer.id}`, {
        source: durable.getActorRef(snapshot)!,
        id: timer.id
      });
    }
  } else {
    [snapshot, effects] = (durable.initialTransition as () => any)();
    rootAddress = durable.getActorRef(snapshot)?.address;
    // Root-addressed events are retained by the execution and handed out by
    // `waitForEvent()`, so the host only executes the batch.
    await durable.executeEffects(effects);
    transitions++;
  }

  while (snapshot.status === 'active') {
    if (transitions === options.crashAfterTransitions) {
      log(`  host: CRASH after ${transitions} transitions`);
      return {
        status: 'crashed' as const,
        output: undefined,
        checkpoint: checkpoint(snapshot)
      };
    }
    const event = await durable.waitForEvent();
    [snapshot, effects] = durable.transition(snapshot, event);
    await durable.executeEffects(effects);
    transitions++;
  }

  return {
    status: 'done' as const,
    output: snapshot.output,
    checkpoint: checkpoint(snapshot)
  };
}
