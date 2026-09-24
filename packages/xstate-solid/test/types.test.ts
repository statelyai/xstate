import { createMachine, types } from 'xstate';
import { useActor, useActorRef, useMachine } from '../src/index.ts';

describe('types', () => {
  it('should require input when the machine declares an input schema', () => {
    const machine = createMachine({
      schemas: { input: types<{ id: string }>() }
    });

    // Type-only checks: the hooks need a component context to run.
    const check = () => {
      // @ts-expect-error input is required
      useActor(machine);
      // @ts-expect-error input is required
      useActorRef(machine);
      // @ts-expect-error input is required
      useMachine(machine);
      useActor(machine, { input: { id: 'a' } });
      useActorRef(machine, { input: { id: 'a' } });
      useMachine(machine, { input: { id: 'a' } });
    };

    expect(check).toBeTypeOf('function');
  });
});
