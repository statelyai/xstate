import { createMachine, assign } from 'xstate';

interface CounterContext {
  count: number;
}

type CounterEvent = {
  type: 'INCREMENT';
};

export const counterMachine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QGMD2BXAdgFzAJwGIBJAOQGEAlAUQFkqSAVAbQAYBdRUAB1VgEtsfVJk4gAHogCMAFgCcAOgDskgExzZi6SpYqAzADYArABoQAT0QsAvjdOZUEOKLRZceUT36DhoiQhamFv42NkA */
  types: {} as {
    context: CounterContext;
    events: CounterEvent;
  },
  id: 'counter',
  context: { count: 0 },
  on: {
    INCREMENT: {
      actions: assign({ count: ({ context }) => context.count + 1 })
    }
  }
});
