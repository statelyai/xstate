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
});
