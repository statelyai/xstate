import { assign, createActor, setup, SimulatedClock } from 'xstate';

function logCount(_: any, params: { count: number }) {
  console.log(`Current count: ${params.count}`);
}

interface CountingMachineContext {
  count: number;
  wait: boolean;
}

const InitialContext: CountingMachineContext = {
  count: 0,
  wait: false
};

type CountingMachineEvents =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'reset' }
  | { type: 'random' }
  | { type: 'error'; message: string };

const countingMachine = setup({
  types: {
    context: {} as CountingMachineContext,
    events: {} as CountingMachineEvents
  },
  actions: {
    logCount,
    increment: assign({
      count: ({ context }) => context.count + 1
    }),
    decrement: assign({
      count: ({ context }) => context.count - 1
    }),
    reverseIncrement: assign({
      count: ({ context }) => context.count - 1
    }),
    resetBehavior: assign({
      wait: (_) => false
    }),
    applyRandomEvent: assign({
      count: ({ context }) => context.count + Math.floor(Math.random() * 10) - 5
    }),
    enterErrorState: assign({
      count: (_) => 0
    })
  },
  guards: {
    isAtThreshold: ({ context }) => context.count === 3,
    isWaiting: ({ context }) => context.wait,
    isMilestone: ({ context }) => [10, 20, 30].includes(context.count)
  },
  delays: {
    waitDelay: 400,
    holdDelay: 2000
  }
}).createMachine({
  context: InitialContext,
  initial: 'Normal',
  states: {
    Normal: {
      entry: [
        {
          type: 'logCount',
          params: ({ context }) => ({ count: context.count })
        }
      ],
      on: {
        increment: [
          {
            cond: 'isWaiting',
            actions: 'reverseIncrement'
          },
          {
            cond: 'isAtThreshold',
            actions: 'increment',
            target: 'Waiting'
          },
          {
            actions: 'increment'
          }
        ],
        decrement: { actions: 'decrement' },
        reset: { actions: 'resetBehavior' },
        random: { actions: 'applyRandomEvent' },
        error: { target: 'Error', actions: 'enterErrorState' }
      },
      always: {
        cond: 'isMilestone',
        target: 'Milestone'
      }
    },
    Waiting: {
      after: {
        waitDelay: 'Normal'
      },
      on: {
        increment: {
          actions: 'reverseIncrement'
        }
      }
    },
    Milestone: {
      entry: () => console.log('Milestone reached!'),
      always: 'Normal'
    },
    Error: {
      entry: ({ event }) => console.error(`Error: ${event.message}`),
      after: {
        holdDelay: 'Normal'
      }
    }
  }
});

describe('countingMachine', () => {
  it('should increment and decrement the count', () => {
    const actor = createActor(countingMachine).start();

    actor.send({ type: 'increment' });
    expect(actor.getSnapshot().context.count).toEqual(1);

    actor.send({ type: 'decrement' });
    expect(actor.getSnapshot().context.count).toEqual(0);
  });

  it('should enforce a 400 ms wait at count 3', () => {
    const clock = new SimulatedClock();
    const actor = createActor(countingMachine, { clock }).start();

    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    expect(actor.getSnapshot().value).toEqual('Waiting');

    clock.increment(400);
    expect(actor.getSnapshot().value).toEqual('Normal');
  });

  it('should reverse increment to decrement during wait', () => {
    const clock = new SimulatedClock();
    const actor = createActor(countingMachine, { clock }).start();

    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    expect(actor.getSnapshot().value).toEqual('Waiting');

    actor.send({ type: 'increment' });
    expect(actor.getSnapshot().context.count).toEqual(2);
  });

  it('should reset behavior after 2 seconds in Error state', () => {
    const clock = new SimulatedClock();
    const actor = createActor(countingMachine, { clock }).start();

    actor.send({ type: 'error', message: 'Test Error' });
    expect(actor.getSnapshot().value).toEqual('Error');

    clock.increment(2000);
    expect(actor.getSnapshot().value).toEqual('Normal');
  });

  it('should celebrate milestones', () => {
    const actor = createActor(countingMachine).start();

    for (let i = 0; i < 10; i++) {
      actor.send({ type: 'increment' });
    }
    expect(actor.getSnapshot().value).toEqual('Milestone');
  });

  it('should handle random events', () => {
    const actor = createActor(countingMachine).start();

    actor.send({ type: 'random' });
    const countAfterRandomEvent = actor.getSnapshot().context.count;
    expect(countAfterRandomEvent).toBeGreaterThanOrEqual(-5);
    expect(countAfterRandomEvent).toBeLessThanOrEqual(5);
  });
});
