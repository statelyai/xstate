import { assign, createActor, setup, SimulatedClock } from 'xstate';

function celebrate(_: any) {
  console.log('Celebration! Count reached 7!');
}

interface CountingContext {
  count: number;
}

const initialContext: CountingContext = {
  count: 0
};

type CountingEvents =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'holdIncrement' };

const countingMachine = setup({
  types: {
    context: {} as CountingContext,
    events: {} as CountingEvents
  },
  actions: {
    increment: assign({
      count: ({ context }) => context.count + 1
    }),
    decrement: assign({
      count: ({ context }) => context.count - 1
    }),
    invertIncrement: assign({
      count: ({ context }) => context.count - 1
    }),
    invertDecrement: assign({
      count: ({ context }) => context.count + 1
    }),
    celebrate
  },
  guards: {
    reachedThreshold: ({ context }) => context.count === 3,
    reachedMilestone: ({ context }) => context.count === 7
  },
  delays: {
    waitDelay: 400
  }
}).createMachine({
  context: initialContext,
  initial: 'normal',
  states: {
    normal: {
      on: {
        increment: [
          {
            target: 'delayed',
            guard: 'reachedThreshold'
          },
          {
            actions: 'increment',
            guard: 'reachedMilestone',
            internal: false,
            after: {
              type: 'celebrate'
            }
          },
          {
            actions: 'increment'
          }
        ],
        decrement: {
          actions: 'decrement'
        }
      }
    },
    delayed: {
      after: {
        waitDelay: 'normal'
      },
      on: {
        increment: {
          target: 'inverted'
        }
      }
    },
    inverted: {
      on: {
        increment: {
          actions: 'invertIncrement'
        },
        decrement: {
          actions: 'invertDecrement'
        },
        holdIncrement: {
          target: 'normal',
          internal: false,
          delay: 2000
        }
      }
    }
  }
});

// Type tests to ensure type satisfaction
import {
  type ActorRefFrom,
  type SnapshotFrom,
  type EventFromLogic
} from 'xstate';

// Strongly-typed actor reference
type CountingActorRef = ActorRefFrom<typeof countingMachine>;
// @ts-expect-error
const invalidActorRef: CountingActorRef = { invalid: true }; // Should produce a type error
const validActorRef: CountingActorRef = createActor(countingMachine); // Should be valid

// Strongly-typed snapshot
type CountingSnapshot = SnapshotFrom<typeof countingMachine>;
// @ts-expect-error
const invalidSnapshot: CountingSnapshot = { invalid: true }; // Should produce a type error
const validSnapshot: CountingSnapshot = validActorRef.getSnapshot(); // Should be valid

// Union of all event types
type CountingEvent = EventFromLogic<typeof countingMachine>;
// @ts-expect-error
const invalidEvent: CountingEvent = { invalid: true }; // Should produce a type error
const validEvent: CountingEvent = { type: 'increment' }; // Should be valid

describe('countingMachine', () => {
  it('should increment normally', () => {
    const actor = createActor(countingMachine).start();
    actor.send({ type: 'increment' });
    expect(actor.getSnapshot().context.count).toEqual(1);
  });

  it('should transition to "delayed" state when count reaches 3', () => {
    const actor = createActor(countingMachine).start();
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    expect(actor.getSnapshot().matches('delayed')).toBeTruthy();
  });

  it('should transition to "inverted" state if incremented during delay', () => {
    const clock = new SimulatedClock();
    const actor = createActor(countingMachine, { clock }).start();
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    expect(actor.getSnapshot().matches('inverted')).toBeTruthy();
  });

  it('should increment when decrement event is received in inverted state', () => {
    const actor = createActor(countingMachine).start();
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'decrement' });
    expect(actor.getSnapshot().context.count).toEqual(3);
  });

  it('should transition back to normal state when holdIncrement is held for 2 seconds', () => {
    const clock = new SimulatedClock();
    const actor = createActor(countingMachine, { clock }).start();
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'increment' });
    actor.send({ type: 'holdIncrement' });
    clock.increment(2000);
    expect(actor.getSnapshot().matches('normal')).toBeTruthy();
  });

  it('should celebrate when count reaches 7', () => {
    const actor = createActor(countingMachine).start();
    const celebrateSpy = jest.spyOn(console, 'log').mockImplementation();
    for (let i = 0; i < 7; i++) {
      actor.send({ type: 'increment' });
    }
    expect(celebrateSpy).toHaveBeenCalledWith('Celebration! Count reached 7!');
    celebrateSpy.mockRestore();
  });
});
