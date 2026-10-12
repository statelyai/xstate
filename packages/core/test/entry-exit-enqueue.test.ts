import {
  createActor,
  createMachine,
  executeEffects,
  initialTransition,
  setup,
  transition,
  types,
  type EnqueueObject,
  type EventObject,
  type AnyStateNode
} from '../src/index.ts';
import { createDoneActorEvent } from '../src/eventUtils.ts';

type Enqueue = EnqueueObject<EventObject, EventObject>;
type RecordActions = { record: (...args: unknown[]) => void };

const shapes = ['direct', 'default', 'rest', 'wrapper', 'third'] as const;

function wrap<TArgs, TEnqueue, TResult>(
  shape: (typeof shapes)[number],
  fn: (args: TArgs, enq: TEnqueue) => TResult
) {
  switch (shape) {
    case 'default':
      return (args: TArgs, enq: TEnqueue = undefined!) => fn(args, enq);
    case 'rest':
      return (...args: [TArgs, TEnqueue]) => fn(...args);
    case 'wrapper':
      return (...args: Parameters<typeof fn>) => fn(...args);
    case 'third':
      return (args: TArgs, enq: TEnqueue, _extra?: unknown) => fn(args, enq);
    default:
      return fn;
  }
}

describe.each(shapes)('entry/exit enqueue with %s parameters', (shape) => {
  it.each(['entry', 'exit'] as const)(
    'collects %s effects and raised events without running effects during planning',
    async (kind) => {
      const record = vi.fn();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const s = setup({
        schemas: { context: types<{ count: number; retained: boolean }>() },
        actions: { record }
      });
      const { entry } = s.createStateConfig({
        entry: (
          {
            context,
            actions
          }: { context: { count: number }; actions: RecordActions },
          enq: Enqueue
        ) => {
          enq(actions.record, kind);
          enq.raise({ type: 'ready' });
          return { context: { count: context.count + 1 } };
        }
      });
      const machine = s.createMachine({
        context: { count: 0, retained: true },
        initial: 'loading',
        states: {
          loading: {
            [kind]: wrap(shape, entry),
            on: {
              ready: { target: 'ready' },
              leave: { target: 'waiting' }
            }
          },
          waiting: { on: { ready: { target: 'ready' } } },
          ready: {}
        }
      });
      let [snapshot, effects] = initialTransition(machine);
      if (kind === 'exit') {
        [snapshot, effects] = transition(machine, snapshot, { type: 'leave' });
      }

      expect(snapshot.value).toBe('ready');
      expect(snapshot.context).toEqual({ count: 1, retained: true });
      expect(record).not.toHaveBeenCalled();
      await executeEffects(effects);
      expect(record).toHaveBeenCalledExactlyOnceWith(kind);
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();

      record.mockClear();
      const actor = createActor(machine).start();
      if (kind === 'exit') {
        actor.send({ type: 'leave' });
      }
      expect(actor.getSnapshot().value).toBe('ready');
      expect(actor.getSnapshot().context).toEqual({ count: 1, retained: true });
      expect(record).toHaveBeenCalledExactlyOnceWith(kind);
    }
  );

  it('applies entry child patches and passes them to nested entry functions', () => {
    const child = createActor(createMachine({}));
    const s = setup({});
    const { entry } = s.createStateConfig({
      entry: (_args: unknown, _enq: Enqueue) => ({ children: { child } })
    });
    const seen: unknown[] = [];
    const machine = s.createMachine({
      initial: 'parent',
      states: {
        parent: {
          entry: wrap(shape, entry),
          initial: 'nested',
          states: {
            nested: {
              entry: ({ children }) => {
                seen.push(children);
              }
            }
          }
        }
      }
    });
    const [snapshot] = initialTransition(machine);
    expect(snapshot.children).toEqual({ child });
    expect(seen).toEqual([{ child }]);
  });

  it('preserves lifecycle output arguments', async () => {
    const record = vi.fn();
    const s = setup({ actions: { record } });
    const { entry } = s.createStateConfig({
      entry: (
        { output, actions }: { output?: unknown; actions: RecordActions },
        enq: Enqueue
      ) => {
        enq(actions.record, output);
      }
    });
    const machine = s.createMachine({
      initial: 'loading',
      states: {
        loading: { on: { 'xstate.done.actor': { target: 'ready' } } },
        ready: { entry: wrap(shape, entry) }
      }
    });
    const [initial] = initialTransition(machine);
    const [, effects] = transition(
      machine,
      initial,
      createDoneActorEvent('worker', 42, 'session')
    );
    await executeEffects(effects);
    expect(record).toHaveBeenCalledExactlyOnceWith(42);
  });

  it('collects completion exit effects and context patches', async () => {
    const record = vi.fn();
    const s = setup({
      schemas: { context: types<{ closed: boolean }>() },
      actions: { record }
    });
    const { exit } = s.createStateConfig({
      exit: ({ actions }: { actions: RecordActions }, enq: Enqueue) => {
        enq(actions.record);
        return { context: { closed: true } };
      }
    });
    const machine = s.createMachine({
      context: { closed: false },
      exit: wrap(shape, exit),
      output: () => 'finished',
      initial: 'open',
      states: {
        open: { on: { close: { target: 'closed' } } },
        closed: { type: 'final' }
      }
    });
    const [initial] = initialTransition(machine);
    const [snapshot, effects] = transition(machine, initial, { type: 'close' });
    expect(snapshot.status).toBe('done');
    expect(snapshot.context.closed).toBe(true);
    expect(record).not.toHaveBeenCalled();
    await executeEffects(effects);
    expect(record).toHaveBeenCalledExactlyOnceWith();
  });
});

it('preserves exit, transition and entry effect ordering', async () => {
  const record = vi.fn();
  const s = setup({
    schemas: { context: types<{ count: number }>() },
    actions: { record }
  });
  const { entry: update } = s.createStateConfig({
    entry: (
      {
        context,
        actions,
        stateNode
      }: {
        context: { count: number };
        actions: RecordActions;
        stateNode: AnyStateNode;
      },
      enq: Enqueue
    ) => {
      enq(actions.record, stateNode.key);
      return { context: { count: context.count + 1 } };
    }
  });
  const machine = s.createMachine({
    context: { count: 0 },
    initial: 'a',
    states: {
      a: {
        exit: wrap('wrapper', update),
        on: {
          next: ({ actions }, enq) => {
            enq(actions.record, 'transition');
            return { target: 'b', context: { count: 10 } };
          }
        }
      },
      b: { entry: wrap('default', update) }
    }
  });
  const [initial, initialEffects] = initialTransition(machine);
  expect(initialEffects).toEqual([]);
  const [snapshot, effects] = transition(machine, initial, { type: 'next' });
  expect(snapshot.context.count).toBe(11);
  expect(record).not.toHaveBeenCalled();
  expect(effects).toHaveLength(3);
  await executeEffects(effects);
  expect(record.mock.calls).toEqual([['a'], ['transition'], ['b']]);
});

it('does not add effects for entry and exit functions returning only patches', () => {
  const machine = createMachine({
    context: { count: 0 },
    entry: () => ({ context: { count: 1 } }),
    initial: 'a',
    states: {
      a: {
        exit: ({ context }) => ({ context: { count: context.count + 1 } }),
        on: { next: { target: 'b' } }
      },
      b: { entry: ({ context }) => ({ context: { count: context.count + 1 } }) }
    }
  });
  const [initial, initialEffects] = initialTransition(machine);
  expect(initialEffects).toEqual([]);
  const [snapshot, effects] = transition(machine, initial, { type: 'next' });
  expect(snapshot.context.count).toBe(3);
  expect(effects).toEqual([]);
});
