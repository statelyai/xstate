import {
  createMachine,
  machineFromJSON,
  setup,
  type MachineJSON
} from '../src/index.ts';

describe('versioned machines require an id', () => {
  it('throws when a machine declares a version without an id', () => {
    expect(() =>
      // @ts-expect-error A machine with a `version` must declare an `id`.
      createMachine({
        version: '2',
        initial: 'a',
        states: { a: {} }
      })
    ).toThrow("Machine with version '2' must declare an id.");
  });

  it('throws for setup machines', () => {
    expect(() =>
      // @ts-expect-error A machine with a `version` must declare an `id`.
      setup({}).createMachine({ version: '2' })
    ).toThrow("Machine with version '2' must declare an id.");
  });

  it('throws for JSON machines', () => {
    // @ts-expect-error A machine with a `version` must declare an `id`.
    const json: MachineJSON = { version: '2' };

    expect(() => machineFromJSON(json)).toThrow(
      "Machine with version '2' must declare an id."
    );
  });

  it('accepts a version with an id, and neither', () => {
    expect(createMachine({ id: 'order', version: '2' }).version).toBe('2');
    expect(setup({}).createMachine({ id: 'order', version: '2' }).version).toBe(
      '2'
    );
    expect(machineFromJSON({ id: 'order', version: '2' }).version).toBe('2');
    expect(createMachine({}).version).toBeUndefined();
    expect(createMachine({ id: 'order' }).version).toBeUndefined();
  });
});
