import { createActor, SimulatedClock } from 'xstate';
interface CounterMachineContext {
  count: number;
  isWaiting: boolean;
  isNormalState: boolean;
}

const initialContext: CounterMachineContext = {
  count: 0,
  isWaiting: false,
  isNormalState: true
};
type CounterMachineEvents =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'reset' }
  | { type: 'celebrate' }
  | { type: 'random.modify'; value: number };
const actions = {
  increment: assign<CounterMachineContext>({
    count: ({ context }) => context.count + 1
  }),
  decrement: assign<CounterMachineContext>({
    count: ({ context }) => context.count - 1
  }),
  reverseIncrement: assign<CounterMachineContext>({
    count: ({ context }) => context.count - 1
  }),
  celebrate: () => console.log('Celebration!'),
  applyRandomModification: assign<
    CounterMachineContext,
    { type: 'random.modify'; value: number }
  >({
    count: ({ context }, event) => context.count + event.value
  }),
  resetState: assign<CounterMachineContext>({
    isNormalState: true,
    isWaiting: false
  })
};
const guards = {
  isCountThree: ({ context }: { context: CounterMachineContext }) =>
    context.count === 3,
  isCountSeven: ({ context }: { context: CounterMachineContext }) =>
    context.count === 7
};
import { createMachine, assign, interpret } from 'xstate';

const counterMachine = createMachine<
  CounterMachineContext,
  CounterMachineEvents
>(
  {
    id: 'counter',
    initial: 'Normal',
    context: initialContext,
    states: {
      Normal: {
        always: [{ guard: 'isCountSeven', target: 'Celebrating' }],
        on: {
          increment: [
            {
              guard: 'isCountThree',
              target: 'Waiting'
            },
            { actions: 'increment' }
          ],
          decrement: { actions: 'decrement' },
          'random.modify': { actions: 'applyRandomModification' },
          reset: { actions: 'resetState' }
        }
      },
      Waiting: {
        after: {
          400: {
            target: 'Normal',
            actions: assign({ isWaiting: false })
          }
        },
        on: {
          increment: { actions: 'reverseIncrement' },
          reset: { actions: 'resetState' }
        },
        entry: assign({ isWaiting: true })
      },
      Celebrating: {
        entry: ['celebrate'],
        always: { target: 'Normal' }
      }
    },
    on: {
      'random.modify': { actions: 'applyRandomModification' },
      reset: { actions: 'resetState' }
    }
  },
  {
    actions,
    guards
  }
);

describe('counterMachine', () => {
  it('should increment and transition to Waiting state at count 3', () => {
    const actor = createActor(counterMachine).start();

    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    expect(actor.getSnapshot().value).toEqual('Waiting');
    expect(actor.getSnapshot().context.count).toEqual(3);
  });

  it('should reverse increment to decrement in Waiting state', () => {
    const actor = createActor(counterMachine).start();

    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    expect(actor.getSnapshot().context.count).toEqual(3);
  });

  it('should reset state to normal after reset event', () => {
    const actor = createActor(counterMachine).start();

    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'reset' });
    expect(actor.getSnapshot().context.isNormalState).toBeTruthy();
    expect(actor.getSnapshot().context.isWaiting).toBeFalsy();
  });

  it('should celebrate at count 7', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    const actor = createActor(counterMachine).start();

    for (let i = 0; i < 7; i++) {
      actor.send({ type: 'increment' });
    }

    expect(logSpy).toHaveBeenCalledWith('Celebration!');
    logSpy.mockRestore();
  });

  it('should apply random modification to the count', () => {
    const actor = createActor(counterMachine).start();

    actor.send({ type: 'random.modify', value: 5 });
    expect(actor.getSnapshot().context.count).toEqual(5);
  });

  it('should transition to normal state after 400ms', () => {
    const clock = new SimulatedClock();
    const actor = createActor(counterMachine, {
      clock
    }).start();

    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });

    expect(actor.getSnapshot().value).toEqual('Waiting');

    clock.increment(400);

    expect(actor.getSnapshot().value).toEqual('Normal');
  });
});
