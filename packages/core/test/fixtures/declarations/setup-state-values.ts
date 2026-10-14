import {
  createActor,
  setup,
  types,
  type StateSchema,
  type StateSchemaFrom
} from '../../../src/index.ts';

// Inferred setup schemas represent absent fields with explicit undefined.
const leafSchema = {
  id: undefined,
  states: undefined,
  contextSchema: undefined,
  outputSchema: undefined
} satisfies StateSchema;

export const machine = setup({
  schemas: { context: types<{ n: number }>() },
  states: { a: {}, b: { states: { x: {}, y: {} } } }
}).createMachine({
  context: { n: 0 },
  initial: 'a',
  states: { a: {}, b: { initial: 'x', states: { x: {}, y: {} } } }
});

type Value = ReturnType<typeof machine.getInitialSnapshot>['value'];
declare const stateSchema: StateSchemaFrom<typeof machine>;
stateSchema satisfies StateSchema;

const atomic: Value = 'a';
const compound: Value = { b: 'x' };
const otherChild: Value = { b: 'y' };
// @ts-expect-error - compound states must include a child value
const flattened: Value = 'b';
// @ts-expect-error - z is not a child of b
const invalid: Value = { b: 'z' };
declare const value: Value;
value satisfies 'a' | { b: 'x' | 'y' };

const snapshot = createActor(machine).getSnapshot();
snapshot.matches({ b: 'x' });
snapshot.matches('b.x');
// @ts-expect-error - z is not a child of b
snapshot.matches({ b: 'z' });
// @ts-expect-error - z is not a child of b
snapshot.matches('b.z');

export const parallelMachine = setup({
  states: {
    active: {
      type: 'parallel',
      states: {
        left: { states: { off: {}, on: {} } },
        right: { states: { idle: {}, busy: {} } }
      }
    }
  }
}).createMachine({
  initial: 'active',
  states: {
    active: {
      states: {
        left: { initial: 'off', states: { off: {}, on: {} } },
        right: { initial: 'idle', states: { idle: {}, busy: {} } }
      }
    }
  }
});

type ParallelValue = ReturnType<
  typeof parallelMachine.getInitialSnapshot
>['value'];
const parallel: ParallelValue = { active: { left: 'on', right: 'busy' } };
// @ts-expect-error - parallel states require values for both regions
const missingRegion: ParallelValue = { active: { left: 'on' } };
declare const parallelValue: ParallelValue;
parallelValue satisfies {
  active: { left: 'off' | 'on'; right: 'idle' | 'busy' };
};

const parallelSnapshot = createActor(parallelMachine).getSnapshot();
parallelSnapshot.matches({ active: { left: 'on' } });
parallelSnapshot.matches('active.right.busy');
// @ts-expect-error - busy is not a child of left
parallelSnapshot.matches('active.left.busy');

void [
  leafSchema,
  atomic,
  compound,
  otherChild,
  flattened,
  invalid,
  parallel,
  missingRegion
];
