import fc from 'fast-check';
import { Effect } from 'effect';
import {
  createActor,
  createCallbackLogic,
  createMachine,
  setup,
  types,
  type AnyActorRef,
  type AnyEventObject,
  type AnyStateMachine,
  type Snapshot
} from 'xstate';
import { createEffectActor } from './index.ts';
import { sendAndAwait } from './test.ts';

interface Scenario {
  readonly logic: AnyStateMachine;
  readonly events: readonly AnyEventObject[];
  readonly stopOn?: string;
}

const statusOf = (actor: AnyActorRef) =>
  (actor.getSnapshot() as Snapshot<unknown>).status;

type StoppableActor = AnyActorRef & { stop(): unknown };

const stopOnEmit = (actor: StoppableActor, type: string | undefined) => {
  if (type) {
    actor.on(type, () => {
      actor.stop();
    });
  }
};

const record = (actor: AnyActorRef, trace: string[]) => {
  actor.on('*', (event) => {
    trace.push(`emit ${event.type} @${statusOf(actor)}`);
  });
  return new Promise<void>((resolve) => {
    actor.subscribe({
      next: (snapshot: Snapshot<unknown> & { value?: unknown }) => {
        trace.push(
          `next ${snapshot.status} ${JSON.stringify(snapshot.value)} @${statusOf(actor)}`
        );
      },
      error: () => {
        trace.push(`error @${statusOf(actor)}`);
        resolve();
      },
      complete: () => {
        trace.push(`complete @${statusOf(actor)}`);
        resolve();
      }
    });
  });
};

const endOf = (actor: AnyActorRef) => {
  const snapshot = actor.getSnapshot() as Snapshot<unknown>;
  return `end ${snapshot.status} ${JSON.stringify(snapshot.output ?? null)}`;
};

const dropInitialNext = (trace: string[]) => {
  trace.splice(
    trace.findIndex((entry) => entry.startsWith('next ')),
    1
  );
};

const traceCreateActor = async (scenario: Scenario) => {
  const trace: string[] = [];
  const actor = createActor(scenario.logic);
  stopOnEmit(actor, scenario.stopOn);
  const settled = record(actor, trace);
  actor.start();
  dropInitialNext(trace);
  for (const event of scenario.events) {
    if (statusOf(actor) !== 'active') {
      trace.push(`dead ${event.type}`);
      continue;
    }
    actor.send(event);
    trace.push(`sent ${event.type} -> ${statusOf(actor)}`);
  }
  if (scenario.events.length && statusOf(actor) === 'active') actor.stop();
  await settled;
  trace.push(endOf(actor));
  return trace;
};

const traceCreateEffectActor = (scenario: Scenario) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const trace: string[] = [];
        const actor = yield* createEffectActor(scenario.logic);
        stopOnEmit(actor, scenario.stopOn);
        const settled = record(actor, trace);
        for (const event of scenario.events) {
          if (statusOf(actor) !== 'active') {
            trace.push(`dead ${event.type}`);
            continue;
          }
          yield* Effect.exit(sendAndAwait(actor, event as never));
          trace.push(`sent ${event.type} -> ${statusOf(actor)}`);
        }
        if (scenario.events.length && statusOf(actor) === 'active') {
          actor.stop();
        }
        yield* Effect.promise(() => settled);
        trace.push(endOf(actor));
        return trace;
      })
    )
  );

const expectSameTrace = async (scenario: Scenario) => {
  const expected = await traceCreateActor(scenario);
  expect(await traceCreateEffectActor(scenario)).toEqual(expected);
};

const moves = {
  PING: (_args: unknown, enq: any) => {
    enq.emit({ type: 'pinged' });
  },
  RAISE: (_args: unknown, enq: any) => {
    enq.emit({ type: 'raising' });
    enq.raise({ type: 'PING' });
  },
  FINISH: (_args: unknown, enq: any) => {
    enq.emit({ type: 'finishing' });
    return { target: 'done' };
  },
  BOOM: () => {
    throw new Error('boom');
  }
};

const machine = createMachine({
  schemas: {
    events: {
      PING: types<{}>(),
      STEP: types<{}>(),
      RAISE: types<{}>(),
      FINISH: types<{}>(),
      BOOM: types<{}>()
    },
    emitted: {
      pinged: types<{}>(),
      stepped: types<{}>(),
      raising: types<{}>(),
      finishing: types<{}>(),
      finished: types<{}>()
    }
  },
  initial: 'a',
  states: {
    a: {
      on: {
        ...moves,
        STEP: (_args, enq) => {
          enq.emit({ type: 'stepped' });
          return { target: 'b' };
        }
      }
    },
    b: {
      on: {
        ...moves,
        STEP: (_args, enq) => {
          enq.emit({ type: 'stepped' });
          return { target: 'a' };
        }
      }
    },
    done: {
      type: 'final',
      entry: (_args, enq) => {
        enq.emit({ type: 'finished' });
      },
      output: () => 'finished'
    }
  }
});

const childOrder = setup({
  schemas: {
    events: { NUMBER: types<{ n: number }>(), DONE: types<{}>() },
    emitted: { number: types<{ n: number }>(), finished: types<{}>() }
  },
  actors: {
    child: createCallbackLogic(({ sendBack }) => {
      sendBack({ type: 'NUMBER', n: 1 });
      sendBack({ type: 'NUMBER', n: 2 });
      sendBack({ type: 'DONE' });
    })
  }
}).createMachine({
  invoke: { src: 'child' },
  initial: 'listening',
  states: {
    listening: {
      on: {
        NUMBER: ({ event }, enq) => {
          enq.emit({ type: 'number', n: event.n });
        },
        DONE: { target: 'finished' }
      }
    },
    finished: {
      type: 'final',
      entry: (_args, enq) => {
        enq.emit({ type: 'finished' });
      }
    }
  }
});

const send = (...types: string[]) => types.map((type) => ({ type }));

describe('createEffectActor shows observers the order of createActor', () => {
  it.each<[string, Scenario]>([
    [
      'emits before next in an active step',
      { logic: machine, events: send('PING', 'STEP') }
    ],
    [
      'raised events in one macrostep',
      { logic: machine, events: send('RAISE') }
    ],
    [
      'final emits before next(done) and complete',
      { logic: machine, events: send('FINISH', 'PING') }
    ],
    [
      'stop during the final emits keeps done',
      { logic: machine, events: send('FINISH'), stopOn: 'finishing' }
    ],
    [
      'stop during an active step runs after the step',
      { logic: machine, events: send('RAISE', 'PING'), stopOn: 'raising' }
    ],
    [
      'a thrown transition errors the actor',
      { logic: machine, events: send('PING', 'BOOM', 'PING') }
    ],
    ['child data before child completion', { logic: childOrder, events: [] }]
  ])('%s', (_name, scenario) => expectSameTrace(scenario));

  it('for generated event sequences and stop points', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom('PING', 'STEP', 'RAISE', 'FINISH', 'BOOM'), {
          minLength: 1,
          maxLength: 6
        }),
        fc.constantFrom(
          undefined,
          'pinged',
          'stepped',
          'raising',
          'finishing',
          'finished'
        ),
        (types, stopOn) =>
          expectSameTrace({ logic: machine, events: send(...types), stopOn })
      ),
      { seed: 5862, numRuns: 50 }
    );
  });
});
