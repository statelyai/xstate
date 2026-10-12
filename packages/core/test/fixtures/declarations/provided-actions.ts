import { setup, types } from '../../../src/index.ts';

const base = setup({
  schemas: { context: types<{ count: number }>() },
  actions: {
    step: (): { context: { count: number } } => ({ context: { count: 1 } })
  }
}).createMachine({
  context: { count: 0 },
  on: { tick: ({ actions }) => actions.step() }
});

export const provided = base.provide({
  actions: { step: () => ({ context: { count: 2 } }) }
});

export function withStep(step: () => { context: { count: number } }) {
  return base.provide({ actions: { step } });
}

export const providedAgain = provided.provide({
  actions: { step: () => ({ context: { count: 3 } }) }
});
