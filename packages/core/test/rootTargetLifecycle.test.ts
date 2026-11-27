import {
  createActor,
  createCallbackLogic,
  createMachine,
  initialTransition,
  transition
} from '../src/index.ts';

it.each([false, true])(
  'pairs root lifecycle effects when a descendant targets the root, reenter=%s',
  (reenter) => {
    const record = (_label: string) => {};
    const machine = createMachine({
      id: 'root',
      initial: 'child',
      entry: (_, enq) => enq(record, 'entry root'),
      exit: (_, enq) => enq(record, 'exit root'),
      states: {
        child: {
          entry: (_, enq) => enq(record, 'entry child'),
          exit: (_, enq) => enq(record, 'exit child'),
          on: { GO: { target: '#root', reenter } }
        }
      }
    });
    const [initial] = initialTransition(machine);
    const [next, effects] = transition(machine, initial, { type: 'GO' });
    expect(next.value).toBe('child');
    expect(effects.map((effect) => effect.args[0])).toEqual(
      reenter
        ? ['exit child', 'exit root', 'entry root', 'entry child']
        : ['exit child', 'entry child']
    );
  }
);

it.each([false, true])(
  'only restarts root invocations with explicit reentry, reenter=%s',
  (reenter) => {
    let starts = 0;
    let stops = 0;
    const machine = createMachine({
      id: 'root',
      initial: 'child',
      invoke: {
        src: createCallbackLogic(() => {
          starts++;
          return () => {
            stops++;
          };
        })
      },
      states: { child: { on: { GO: { target: '#root', reenter } } } }
    });
    const actor = createActor(machine).start();
    try {
      actor.send({ type: 'GO' });
      expect(starts).toBe(reenter ? 2 : 1);
      expect(stops).toBe(reenter ? 1 : 0);
      expect(actor.getSnapshot().value).toBe('child');
    } finally {
      actor.stop();
    }
    expect(stops).toBe(starts);
  }
);

it.each([false, true])(
  'still reenters a non-root ancestor targeted by its child, reenter=%s',
  (reenter) => {
    const tracked: string[] = [];
    const record = (value: string) => tracked.push(value);
    const machine = createMachine({
      initial: 'parent',
      states: {
        parent: {
          id: 'parent',
          initial: 'child',
          entry: (_, enq) => enq(record, 'entry parent'),
          exit: (_, enq) => enq(record, 'exit parent'),
          states: {
            child: { on: { GO: { target: '#parent', reenter } } }
          }
        }
      }
    });
    const actor = createActor(machine).start();
    try {
      tracked.length = 0;
      actor.send({ type: 'GO' });
      expect(tracked).toEqual(['exit parent', 'entry parent']);
      expect(actor.getSnapshot().value).toEqual({ parent: 'child' });
    } finally {
      actor.stop();
    }
  }
);

it('reapplies root initial input before entering its reset child', () => {
  const inputs: unknown[] = [];
  const invokedInputs: unknown[] = [];
  const machine = createMachine({
    id: 'root',
    initial: { target: 'child', input: { userId: 'u1' } },
    states: {
      child: {
        invoke: {
          src: createCallbackLogic(({ input }) => {
            invokedInputs.push(input);
          }),
          input: ({ input }) => input
        },
        entry: ({ input }) => {
          inputs.push(input);
        },
        on: { GO: { target: '#root' } }
      }
    }
  });
  const actor = createActor(machine).start();
  try {
    actor.send({ type: 'GO' });
    expect(inputs).toEqual([{ userId: 'u1' }, { userId: 'u1' }]);
    expect(invokedInputs).toEqual(inputs);
    expect(actor.getSnapshot().value).toBe('child');
  } finally {
    actor.stop();
  }
});

it('runs root initial content only when the transition selects it', () => {
  const record = (_label: string) => {};
  const machine = createMachine({
    id: 'root',
    context: { starts: 0 },
    initial: {
      target: 'child',
      to: ({ context }: { context: { starts: number } }) => ({
        target: '.child',
        context: { starts: context.starts + 1 }
      })
    },
    states: {
      child: {
        entry: (_, enq) => enq(record, 'entry child'),
        on: { RESET: { target: '#root' }, RESTORE: { target: '#history' } }
      },
      other: {},
      history: { id: 'history', type: 'history', target: 'other' }
    }
  });

  const [initial] = initialTransition(machine);
  const [restored] = transition(machine, initial, { type: 'RESTORE' });
  expect(restored.value).toBe('other');
  expect(restored.context.starts).toBe(1);

  const [reset, effects] = transition(machine, initial, { type: 'RESET' });
  expect(reset.value).toBe('child');
  expect(reset.context.starts).toBe(2);
  expect(reset.nodes).toContain(machine.states.child);
  expect(effects.map((effect) => effect.args[0])).toEqual(['entry child']);
});
