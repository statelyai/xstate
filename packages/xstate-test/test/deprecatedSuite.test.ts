import * as fc from 'fast-check';
import { createMachine, types } from 'xstate';
import { generatePropertySuite, generateTestSuite } from '../src/index.ts';

const machine = createMachine({
  id: 'toggle',
  initial: 'off',
  schemas: { events: { TOGGLE: types<{}>() } },
  states: {
    off: { on: { TOGGLE: { target: 'on' } } },
    on: { on: { TOGGLE: { target: 'off' } } }
  }
});

it('`generatePropertySuite()` keeps the implicit fast-check adapter', async () => {
  // It must shadow the generator-neutral alias re-exported from `xstate/graph`,
  // which would throw for a missing `adapter`.
  expect(generatePropertySuite).toBe(generateTestSuite);

  const suite = await generatePropertySuite(machine, {
    events: { TOGGLE: fc.constant({}) },
    numRuns: 3,
    seed: 1,
    invariant: () => {}
  });

  expect(suite.fixtures.length).toBeGreaterThan(0);
});
