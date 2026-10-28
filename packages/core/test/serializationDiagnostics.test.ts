import {
  createAsyncLogic,
  createMachine,
  getMachineSerializationDiagnostics,
  machineFromJSON,
  machineToJSON,
  types
} from '../src/index.ts';

it('reports undefined object properties and array entries omitted during export', () => {
  const machine = createMachine({
    context: { selected: undefined, items: [1, undefined, null, 2] }
  });

  expect(machineToJSON(machine).context).toEqual({ items: [1, null, 2] });
  expect(getMachineSerializationDiagnostics(machine)).toEqual([
    expect.objectContaining({
      code: 'omitted-value',
      path: '/context/selected'
    }),
    expect.objectContaining({
      code: 'omitted-value',
      path: '/context/items/1'
    })
  ]);
});

it('identifies omitted actors, schemas, source bindings and code without running functions', () => {
  const decide = vi.fn(() => ({ target: 'done' }));
  const machine = createMachine({
    schemas: { context: types<{ at: number }>() },
    context: { at: 0 },
    initial: 'working',
    actions: { notify: () => {} },
    states: {
      working: {
        invoke: { src: createAsyncLogic({ run: async () => 1 }) },
        on: { FINISH: decide }
      },
      done: {}
    }
  });
  expect(getMachineSerializationDiagnostics(machine)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'omitted-value',
        path: '/schemas/context'
      }),
      expect.objectContaining({
        code: 'omitted-value',
        path: '/states/working/invoke/src'
      }),
      expect.objectContaining({
        code: 'runtime-source',
        path: '/actions/notify'
      }),
      expect.objectContaining({
        code: 'code-expression',
        path: '/states/working/on/FINISH'
      })
    ])
  );
  expect(decide).not.toHaveBeenCalled();
});

it('retains JSON pointer paths and handles shared and cyclic values', () => {
  const shared = { value: 1 };
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  const machine = createMachine({
    context: { shared, other: shared, cyclic, 'a/b~': new Date() }
  });
  expect(getMachineSerializationDiagnostics(machine)).toEqual([
    expect.objectContaining({
      path: '/context/cyclic/self',
      code: 'unsupported-value'
    }),
    expect.objectContaining({ path: '/context/a~1b~0', code: 'omitted-value' })
  ]);
});

it('checks the original JSON representation of revived machines', () => {
  const machine = machineFromJSON({ initial: 'idle', states: { idle: {} } });
  expect(getMachineSerializationDiagnostics(machine)).toEqual([]);
});
