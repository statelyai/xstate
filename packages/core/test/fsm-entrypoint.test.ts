import * as fsm from '../src/fsm/index.ts';

describe('xstate/fsm', () => {
  it('exports only the pure FSM API', () => {
    expect(fsm.createFSM).toBeDefined();
    expect(fsm.setup).toBeDefined();
    expect(fsm.types).toBeDefined();
    expect(fsm).not.toHaveProperty('createActor');
    expect(fsm).not.toHaveProperty('createFSMActor');
  });

  it('creates and transitions a machine', () => {
    const machine = fsm.createFSM({
      initial: 'inactive',
      states: {
        inactive: { on: { toggle: 'active' } },
        active: { on: { toggle: 'inactive' } }
      }
    });

    expect(
      machine.transition(machine.initialState, { type: 'toggle' })
    ).toEqual({ value: 'active', context: {} });
  });
});
