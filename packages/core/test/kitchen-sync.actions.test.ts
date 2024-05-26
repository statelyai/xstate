import {
  ActorRefFrom,
  and,
  assign,
  cancel,
  createActor,
  createMachine,
  enqueueActions,
  fromPromise,
  fromTransition,
  log,
  not,
  raise,
  sendParent,
  sendTo,
  setup,
  spawnChild,
  stopChild
} from '../src';

describe('Consolidated Actions Setup', () => {
  const childMachine = createMachine({
    id: 'child',
    initial: 'active',
    states: {
      active: {
        on: {
          FINISH: 'done'
        }
      },
      done: {
        type: 'final'
      }
    },
    exit: sendParent({ type: 'CHILD_DONE' })
  });

  const machine = setup({
    types: {} as {
      context: {
        count: number;
        enabled: boolean;
        data?: any;
        child?: ActorRefFrom<typeof childMachine>;
      };
      events:
        | { type: 'FOO' }
        | { type: 'BAR' }
        | { type: 'NEXT' }
        | { type: 'SOMETHING' }
        | { type: 'FINISH_CHILD' }
        | { type: 'CHILD_DONE' }
        | { type: 'e1' }
        | { type: 'SOMETHING_ELSE' };
      children: {
        myChild: 'child';
        fetchUserChild: 'fetchUser';
      };
      meta: { layout: string };
    },
    guards: {
      check: () => true,
      checkStuff: () => true,
      checkWithParams: (_: any, params: number) => true,
      checkContext: ({ context }: any) => context.enabled,
      opposite: not('check'),
      combinedCheck: and([
        { type: 'check' },
        { type: 'checkWithParams', params: 42 } // Ensure the correct parameter type is provided
      ])
    },
    actions: {
      resetTo: assign((_, params: number) => ({
        count: params
      })),
      spawnFetcher: assign(({ spawn }) => ({
        data: {
          child: spawn(childMachine)
        }
      })),
      raiseFoo: raise({ type: 'FOO' }),
      sendFoo: sendTo(
        ({ self }) => self,
        { type: 'FOO' },
        // Why can't we use 'hundred' here?
        { delay: 100 }
      ),
      sendParentFoo: sendParent({ type: 'FOO' }),
      enqueueSomething: enqueueActions(({ enqueue }) => {
        enqueue.raise({ type: 'SOMETHING_ELSE' });
      }),
      writeDown: log('foo'),
      revert: cancel('foo'),
      releaseFromDuty: stopChild('foo')
    },
    actors: {
      fetchUser: fromPromise(
        async ({ input }: { input: { userId: string } }) => ({
          id: input.userId,
          name: 'Andarist'
        })
      ),
      greet: fromPromise(async () => 'hello'),
      throwDice: fromPromise(async () => Math.random()),
      reducer: fromTransition((s) => s, { count: 42 }),
      child: childMachine
    },
    delays: {
      hundred: 100
    }
  }).createMachine({
    context: ({ spawn }) => ({
      count: 0,
      enabled: true,
      child: spawn(childMachine)
    }),
    initial: 'a',
    states: {
      a: {
        meta: { layout: 'a-layout' },
        after: {
          hundred: 'b'
        },
        on: {
          NEXT: {
            guard: 'checkStuff',
            target: 'b'
          },
          SOMETHING: {
            actions: 'enqueueSomething'
          },
          FINISH_CHILD: {
            actions: [
              ({ context }) => {
                if (context.child) {
                  return sendTo(() => context.child!, { type: 'FINISH' });
                }
              }
            ]
          },
          CHILD_DONE: {
            actions: () => {
              // Handle child done
            }
          }
        }
      },
      b: {
        meta: { layout: 'b-layout' }
      },
      c: {},
      d: {}
    }
  });

  const actor = createActor(machine);

  it('should setup a comprehensive machine with all functionalities', () => {
    const snapshot = actor.start().getSnapshot();
    expect(snapshot.context.count).toBe(0);
    expect(snapshot.context.enabled).toBe(true);

    // Additional assertions to verify other functionalities
  });

  // Additional tests to verify specific functionalities
});
