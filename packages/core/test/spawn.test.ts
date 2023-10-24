import { createActor, createMachine, fromPromise, spawn } from '../src';

describe('spawn action', () => {
  it('can spawn', () => {
    const actor = createActor(
      createMachine({
        entry: spawn(
          fromPromise(() => Promise.resolve(42)),
          { id: 'child' }
        )
      })
    );

    actor.start();

    expect(actor.getSnapshot().children.child).toBeDefined();
  });

  it('can spawn from named actor', () => {
    const fetchNum = fromPromise(({ input }: { input: number }) =>
      Promise.resolve(input * 2)
    );
    const actor = createActor(
      createMachine({
        types: {
          actors: {} as {
            src: 'fetchNum';
            logic: typeof fetchNum;
          }
        },
        entry: spawn('fetchNum', { id: 'child', input: 21 })
      }).provide({
        actors: { fetchNum }
      })
    );

    actor.start();

    expect(actor.getSnapshot().children.child).toBeDefined();
  });
});
