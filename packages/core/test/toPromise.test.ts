import { createActor, createMachine, fromPromise, toPromise } from '../src';

describe('toPromise', () => {
  it('should be awaitable', async () => {
    const promiseActor = createActor(
      fromPromise(() => Promise.resolve(42))
    ).start();

    const result = await toPromise(promiseActor);

    result satisfies number;

    expect(result).toEqual(42);
  });

  it('should await actors', async () => {
    const machine = createMachine({
      types: {} as {
        output: { count: 42 };
      },
      initial: 'pending',
      states: {
        pending: {
          on: {
            RESOLVE: 'done'
          }
        },
        done: {
          type: 'final'
        }
      },
      output: { count: 42 }
    });

    const actor = createActor(machine).start();

    setTimeout(() => {
      actor.send({ type: 'RESOLVE' });
    }, 1);

    const data = await toPromise(actor);

    data satisfies { count: number };

    expect(data).toEqual({ count: 42 });
  });

  it('should await already done actors', async () => {
    const machine = createMachine({
      types: {} as {
        output: { count: 42 };
      },
      initial: 'done',
      states: {
        done: {
          type: 'final'
        }
      },
      output: { count: 42 }
    });

    const actor = createActor(machine).start();

    const data = await toPromise(actor);

    data satisfies { count: number };

    expect(data).toEqual({ count: 42 });
  });

  it('should handle errors', async () => {
    const machine = createMachine({
      initial: 'pending',
      states: {
        pending: {
          on: {
            REJECT: {
              actions: () => {
                throw new Error('oh noes');
              }
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();

    setTimeout(() => {
      actor.send({ type: 'REJECT' });
    });

    try {
      await toPromise(actor);
    } catch (err) {
      expect(err).toEqual(new Error('oh noes'));
    }
  });

  it('should immediately resolve for a done actor', async () => {
    const machine = createMachine({
      initial: 'done',
      states: {
        done: {
          type: 'final'
        }
      },
      output: {
        count: 100
      }
    });

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().status).toBe('done');
    expect(actor.getSnapshot().output).toEqual({ count: 100 });

    const output = await toPromise(actor);

    expect(output).toEqual({ count: 100 });
  });

  it('should immediately reject for an actor that had an error', async () => {
    const machine = createMachine({
      entry: () => {
        throw new Error('oh noes');
      }
    });

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().status).toBe('error');
    expect(actor.getSnapshot().error).toEqual(new Error('oh noes'));

    await expect(toPromise(actor)).rejects.toEqual(new Error('oh noes'));
  });
});
