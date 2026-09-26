import { createFSM, setup, type FSMSnapshot } from '../src/fsm.ts';
import { types } from '../src/schema.types.ts';
import { createActor } from '../src/createActor.ts';
import { initialTransition, transition } from '../src/transition.ts';
import type { ActorLogic, EventFromLogic, SnapshotFrom } from '../src/types.ts';

type Context =
  | { status: 'idle'; count: number }
  | { status: 'done'; count: number; result: string };

type Event = { type: 'finish'; result: string } | { type: 'reset' };

describe('createFSM types', () => {
  it('types context, event payloads, and state targets', () => {
    const machine = createFSM<Context, Event, { idle: unknown; done: unknown }>(
      {
        initial: 'idle',
        context: { status: 'idle', count: 0 },
        states: {
          idle: {
            on: {
              finish: ({ context, event }) => ({
                target: 'done',
                context: {
                  status: 'done' as const,
                  count: context.count + 1,
                  result: event.result
                }
              }),
              reset: { context: { status: 'idle', count: 0 } }
            }
          },
          done: {}
        }
      }
    );

    machine.transition(machine.initialState, {
      type: 'finish',
      result: 'ok'
    });

    const invalidTarget = createFSM<
      Context,
      Event,
      { idle: unknown; done: unknown }
    >({
      initial: 'idle',
      states: {
        idle: {
          on: {
            reset: {
              // @ts-expect-error target must name a declared state
              target: 'missing'
            }
          }
        },
        done: {}
      }
    });
    void invalidTarget;

    // @ts-expect-error declared context cannot be omitted
    createFSM<Context, Event, { idle: unknown; done: unknown }>({
      initial: 'idle',
      states: { idle: {}, done: {} }
    });

    // @ts-expect-error unknown event
    machine.transition(machine.initialState, { type: 'unknown' });
    // @ts-expect-error event payload must be a string
    machine.transition(machine.initialState, { type: 'finish', result: 1 });
  });

  it('satisfies ActorLogic', () => {
    const machine = createFSM<
      { count: number },
      { type: 'inc' },
      { active: unknown }
    >({
      initial: 'active',
      context: { count: 0 },
      states: { active: { on: { inc: { context: { count: 1 } } } } }
    });

    machine satisfies ActorLogic<
      FSMSnapshot<{ count: number }, 'active'>,
      { type: 'inc' }
    >;

    expectTypeOf<SnapshotFrom<typeof machine>>().toEqualTypeOf<
      FSMSnapshot<{ count: number }, 'active'>
    >();
    expectTypeOf<EventFromLogic<typeof machine>>().toEqualTypeOf<{
      type: 'inc';
    }>();

    const actor = createActor(machine);
    actor.send({ type: 'inc' });
    // @ts-expect-error unknown event
    actor.send({ type: 'unknown' });
    actor.getSnapshot().value satisfies 'active';
    actor.getSnapshot().context.count satisfies number;

    const [, effects] = machine.transition(machine.initialState, {
      type: 'inc'
    });
    expectTypeOf(effects).toEqualTypeOf<never[]>();

    const [next] = transition(machine, machine.initialState, { type: 'inc' });
    next.context.count satisfies number;

    const [initial] = initialTransition(machine);
    initial.value satisfies 'active';
  });

  it('keeps setup snapshot unions for actors', () => {
    const machine = setup({
      schemas: {
        events: { load: types<{ id: string }>() }
      },
      states: {
        idle: {},
        loaded: { schemas: { context: types<{ id: string }>() } }
      }
    }).createFSM({
      initial: 'idle',
      context: {},
      states: {
        idle: {
          on: {
            load: ({ event }) => ({
              target: 'loaded',
              context: { id: event.id }
            })
          }
        },
        loaded: {}
      }
    });

    const snapshot = createActor(machine).getSnapshot();
    if (snapshot.value === 'loaded') {
      snapshot.context.id satisfies string;
    }
  });
});
