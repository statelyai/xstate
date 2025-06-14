import { ActorRefFrom, createActor, next_createMachine } from '../src';

describe('spawn inside machine', () => {
  it('input is required when defined in actor', () => {
    const childMachine = next_createMachine({
      // types: { input: {} as { value: number } }
    });
    const machine = next_createMachine({
      // types: {} as { context: { ref: ActorRefFrom<typeof childMachine> } },
      context: ({ spawn }) => ({
        ref: spawn(childMachine, { input: { value: 42 }, systemId: 'test' })
      })
    });

    const actor = createActor(machine).start();
    expect(actor.system.get('test')).toBeDefined();
  });
});
