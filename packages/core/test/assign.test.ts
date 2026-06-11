import z from 'zod';
import { createActor, createMachine } from '../src/index.ts';

interface CounterContext {
  count: number;
  foo: string;
  maybe?: string;
}

const createCounterMachine = (context: Partial<CounterContext> = {}) =>
  createMachine({
    schemas: {
      context: z.object({
        count: z.number(),
        foo: z.string(),
        maybe: z.string().optional()
      })
    },
    initial: 'counting',
    context: { count: 0, foo: 'bar', ...context },
    states: {
      counting: {
        on: {
          INC: ({ context }) => ({
            target: 'counting',
            context: { ...context, count: context.count + 1 }
          }),
          DEC: ({ context }) => ({
            target: 'counting',
            context: {
              ...context,
              count: context.count - 1
            }
          }),
          WIN_PROP: ({ context }) => ({
            target: 'counting',
            context: {
              ...context,
              count: 100,
              foo: 'win'
            }
          }),
          WIN_STATIC: ({ context }) => ({
            target: 'counting',
            context: {
              ...context,
              count: 100,
              foo: 'win'
            }
          }),
          WIN_MIX: ({ context }) => ({
            target: 'counting',
            context: {
              ...context,
              count: 100,
              foo: 'win'
            }
          }),
          WIN: ({ context }) => ({
            target: 'counting',
            context: {
              ...context,
              count: 100,
              foo: 'win'
            }
          }),
          SET_MAYBE: ({ context }) => ({
            context: {
              ...context,
              maybe: 'defined'
            }
          })
        }
      }
    }
  });

describe('assigning to context', () => {
  it('applies the assignment to context (property assignment)', () => {
    const counterMachine = createCounterMachine();

    const actorRef = createActor(counterMachine).start();
    actorRef.send({
      type: 'DEC'
    });
    const oneState = actorRef.getSnapshot();

    expect(oneState.value).toEqual('counting');
    expect(oneState.context).toEqual({ count: -1, foo: 'bar' });

    actorRef.send({ type: 'DEC' });
    const twoState = actorRef.getSnapshot();

    expect(twoState.value).toEqual('counting');
    expect(twoState.context).toEqual({ count: -2, foo: 'bar' });
  });

  it('applies the assignment to context', () => {
    const counterMachine = createCounterMachine();

    const actorRef = createActor(counterMachine).start();
    actorRef.send({
      type: 'INC'
    });
    const oneState = actorRef.getSnapshot();

    expect(oneState.value).toEqual('counting');
    expect(oneState.context).toEqual({ count: 1, foo: 'bar' });

    actorRef.send({ type: 'INC' });
    const twoState = actorRef.getSnapshot();

    expect(twoState.value).toEqual('counting');
    expect(twoState.context).toEqual({ count: 2, foo: 'bar' });
  });

  it('applies the assignment to multiple properties (property assignment)', () => {
    const counterMachine = createCounterMachine();
    const actorRef = createActor(counterMachine).start();
    actorRef.send({
      type: 'WIN_PROP'
    });

    expect(actorRef.getSnapshot().context).toEqual({ count: 100, foo: 'win' });
  });

  it('applies the assignment to multiple properties (static)', () => {
    const counterMachine = createCounterMachine();
    const actorRef = createActor(counterMachine).start();
    actorRef.send({
      type: 'WIN_STATIC'
    });

    expect(actorRef.getSnapshot().context).toEqual({ count: 100, foo: 'win' });
  });

  it('applies the assignment to multiple properties (static + prop assignment)', () => {
    const counterMachine = createCounterMachine();
    const actorRef = createActor(counterMachine).start();
    actorRef.send({
      type: 'WIN_MIX'
    });

    expect(actorRef.getSnapshot().context).toEqual({ count: 100, foo: 'win' });
  });

  it('applies the assignment to multiple properties', () => {
    const counterMachine = createCounterMachine();
    const actorRef = createActor(counterMachine).start();
    actorRef.send({
      type: 'WIN'
    });

    expect(actorRef.getSnapshot().context).toEqual({ count: 100, foo: 'win' });
  });

  it('applies the assignment to the explicit external state (property assignment)', () => {
    const machine = createCounterMachine({ count: 50, foo: 'bar' });
    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'DEC' });
    const oneState = actorRef.getSnapshot();

    expect(oneState.value).toEqual('counting');
    expect(oneState.context).toEqual({ count: 49, foo: 'bar' });

    actorRef.send({ type: 'DEC' });
    const twoState = actorRef.getSnapshot();

    expect(twoState.value).toEqual('counting');
    expect(twoState.context).toEqual({ count: 48, foo: 'bar' });

    const machine2 = createCounterMachine({ count: 100, foo: 'bar' });

    const actorRef2 = createActor(machine2).start();
    actorRef2.send({ type: 'DEC' });
    const threeState = actorRef2.getSnapshot();

    expect(threeState.value).toEqual('counting');
    expect(threeState.context).toEqual({ count: 99, foo: 'bar' });
  });

  it('applies the assignment to the explicit external state', () => {
    const machine = createCounterMachine({ count: 50, foo: 'bar' });
    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'INC' });
    const oneState = actorRef.getSnapshot();

    expect(oneState.value).toEqual('counting');
    expect(oneState.context).toEqual({ count: 51, foo: 'bar' });

    actorRef.send({ type: 'INC' });
    const twoState = actorRef.getSnapshot();

    expect(twoState.value).toEqual('counting');
    expect(twoState.context).toEqual({ count: 52, foo: 'bar' });

    const machine2 = createCounterMachine({ count: 102, foo: 'bar' });

    const actorRef2 = createActor(machine2).start();
    actorRef2.send({ type: 'INC' });
    const threeState = actorRef2.getSnapshot();

    expect(threeState.value).toEqual('counting');
    expect(threeState.context).toEqual({ count: 103, foo: 'bar' });
  });

  it('should maintain state after unhandled event', () => {
    const counterMachine = createCounterMachine();
    const actorRef = createActor(counterMachine).start();

    actorRef.send({
      type: 'FAKE_EVENT'
    });
    const nextState = actorRef.getSnapshot();

    expect(nextState.context).toBeDefined();
    expect(nextState.context).toEqual({ count: 0, foo: 'bar' });
  });

  it('sets undefined properties', () => {
    const counterMachine = createCounterMachine();
    const actorRef = createActor(counterMachine).start();

    actorRef.send({
      type: 'SET_MAYBE'
    });

    const nextState = actorRef.getSnapshot();

    expect(nextState.context.maybe).toBeDefined();
    expect(nextState.context).toEqual({
      count: 0,
      foo: 'bar',
      maybe: 'defined'
    });
  });

  it('can assign from event', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({
          count: z.number()
        }),
        events: {
          INC: z.object({ value: z.number() })
        }
      },
      initial: 'active',
      context: {
        count: 0
      },
      states: {
        active: {
          on: {
            INC: ({ context, event }) => ({
              context: {
                ...context,
                count: event.value
              }
            })
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'INC', value: 30 });

    expect(actorRef.getSnapshot().context.count).toEqual(30);
  });
});
