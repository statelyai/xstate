import { createFSM } from '../src/fsm.ts';

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
});
