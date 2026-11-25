import { createMachine, setup } from '../../../src/index.ts';

const config = {
  initial: 'home',
  states: {
    home: {},
    cart: { id: 'cart', route: {} },
    checkout: { id: 'checkout', route: () => true }
  }
} as const;

export const machine = createMachine(config);
export const setupMachine = setup({}).createMachine(config);
