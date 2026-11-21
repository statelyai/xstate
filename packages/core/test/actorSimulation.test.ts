import { z } from 'zod';
import { createActor, createAsyncLogic, setup, types } from '../src/index.ts';
import { standardSchemaValidator } from '../src/validation/index.ts';

it('simulates an invoked child finishing, cleans it up, and completes once', async () => {
  const abort = vi.fn();
  const finish = vi.fn();
  const pending = Promise.withResolvers<string>();
  const save = createAsyncLogic({
    schemas: { output: z.string() },
    validator: standardSchemaValidator(),
    run: ({ signal }) => {
      signal.addEventListener('abort', abort);
      return pending.promise;
    }
  });
  const machine = setup({
    actors: { save },
    schemas: { context: types<{ receipt: string | undefined }>() }
  }).createMachine({
    context: { receipt: undefined },
    initial: 'saving',
    states: {
      saving: {
        invoke: {
          id: 'save',
          src: 'save',
          onDone: ({ event }) => {
            expect(abort).toHaveBeenCalledOnce();
            finish(event.output);
            return { context: { receipt: String(event.output) } };
          }
        }
      }
    }
  });
  const actor = createActor(machine, { simulate: true }).start();
  const child = actor.getSnapshot().children.save!;
  const next = vi.fn();
  const complete = vi.fn();
  child.subscribe({ next, complete });

  expect(() =>
    // @ts-expect-error the saved receipt is a string
    actor.simulate.childDone({ id: 'save', output: 42 })
  ).toThrow(/output/);
  expect(child.getSnapshot().status).toBe('active');
  expect(abort).not.toHaveBeenCalled();

  actor.simulate.childDone({ id: 'save', output: 'simulated' });

  expect(child.getSnapshot()).toMatchObject({
    status: 'done',
    output: 'simulated'
  });
  expect(next).toHaveBeenCalledExactlyOnceWith(child.getSnapshot());
  expect(complete).toHaveBeenCalledOnce();
  expect(actor.getSnapshot().context.receipt).toBe('simulated');
  expect(() =>
    actor.simulate.childDone({ id: 'save', output: 'duplicate' })
  ).toThrow(/active invoked child/);

  pending.resolve('real result');
  await pending.promise;
  await Promise.resolve();
  expect(finish).toHaveBeenCalledExactlyOnceWith('simulated');

  if (false) {
    // @ts-expect-error only known invocation IDs are accepted
    actor.simulate.childDone({ id: 'missing', output: 'simulated' });
  }
  actor.stop();
});

it('keeps simulation opt-in and requires the invocation to be active', () => {
  const load = createAsyncLogic({ run: () => new Promise<number>(() => {}) });
  const machine = setup({ actors: { load } }).createMachine({
    initial: 'idle',
    states: {
      idle: { on: { LOAD: { target: 'loading' } } },
      loading: { invoke: { id: 'loader', src: 'load' } }
    }
  });

  const ordinary = createActor(machine).start();
  expect(ordinary.simulate).toBeUndefined();
  ordinary.stop();

  const actor = createActor(machine, { simulate: true });
  expect(() => actor.simulate.childDone({ id: 'loader', output: 1 })).toThrow(
    /active invoked child/
  );
  actor.start();
  expect(() => actor.simulate.childDone({ id: 'loader', output: 1 })).toThrow(
    /active invoked child/
  );
  actor.send({ type: 'LOAD' });
  const child = actor.getSnapshot().children.loader!;
  actor.simulate.childDone({ id: 'loader', output: 1 });
  expect(child.getSnapshot()).toMatchObject({ status: 'done', output: 1 });
  actor.stop();
});
