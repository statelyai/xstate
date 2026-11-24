import { createMachine, types } from 'xstate';
import { createSourceCoverageSession } from '../src/sourceCoverage.ts';

it('preserves event payload and snapshot types across the source coverage session', () => {
  const machine = createMachine({
    schemas: {
      context: types<{ balance: number }>(),
      events: { PAY: types<{ amount: number }>() }
    },
    context: { balance: 10 },
    initial: 'idle',
    states: { idle: {} }
  });
  const control = { observer: undefined, faults: 0 };
  const session = createSourceCoverageSession(machine, control, {
    runtimeId: 'xstate@test',
    validateEvent: (event, snapshot) => {
      const amount: number = event.amount;
      const balance: number = snapshot.context.balance;
      void [amount, balance];
    }
  });
  const balance: number = session.initial.snapshot.context.balance;
  void balance;
  if (false) {
    // @ts-expect-error declared payload remains required
    session.step({ type: 'PAY' });
    // @ts-expect-error unknown public event
    session.step({ type: 'OTHER' });
    // @ts-expect-error runtime identity is required for portable witnesses
    createSourceCoverageSession(machine, control, {});
  }
});

it('requires input when the machine input is required', () => {
  const machine = createMachine({
    schemas: {
      context: types<{ balance: number }>(),
      input: types<{ balance: number }>()
    },
    context: ({ input }) => ({ balance: input.balance }),
    initial: 'idle',
    states: { idle: {} }
  });
  const control = { observer: undefined, faults: 0 };

  createSourceCoverageSession(machine, control, {
    runtimeId: 'xstate@test',
    input: { balance: 10 }
  });

  if (false) {
    // @ts-expect-error required machine input cannot be omitted
    createSourceCoverageSession(machine, control, {
      runtimeId: 'xstate@test'
    });
  }
});
