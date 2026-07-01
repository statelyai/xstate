import { createMachine } from 'xstate';

interface TempContext {
  celsius: number | undefined;
  fahrenheit: number | undefined;
}

interface changeC {
  type: 'changeC';
  value: string;
}

interface changeF {
  type: 'changeF';
  value: string;
}

const isOnlyWhiteSpace = (string: string) => string.trim().length === 0;

export const tempMachine = createMachine({
  types: {
    context: {} as TempContext,
    events: {} as changeC | changeF
  },
  guards: {
    valueIsNumber: ({ event }) => {
      return !isNaN(+event.value);
    }
  },
  actions: {
    onChangeC: ({ context, event, self, parent, children }) => ({
      context: {
        ...context,
        celsius: ({ event }) =>
          isOnlyWhiteSpace(event.value)
            ? undefined
            : +event.value({ context, event, self, parent, children }),
        fahrenheit: ({ event }) =>
          isOnlyWhiteSpace(event.value)
            ? undefined
            : Math.round(+event.value * (9 / 5) + 32)({
                context,
                event,
                self,
                parent,
                children
              })
      }
    }),
    onChangeF: ({ context, event, self, parent, children }) => ({
      context: {
        ...context,
        fahrenheit: ({ event }) =>
          isOnlyWhiteSpace(event.value)
            ? undefined
            : +event.value({ context, event, self, parent, children }),
        celsius: ({ event }) =>
          isOnlyWhiteSpace(event.value)
            ? undefined
            : Math.round((+event.value - 32) * (5 / 9))({
                context,
                event,
                self,
                parent,
                children
              })
      }
    })
  },
  id: 'tempConverter',
  initial: 'ready',
  context: {
    celsius: undefined,
    fahrenheit: undefined
  },
  states: {
    ready: {
      on: {
        changeC: ({ context, event, guards, actions }, enq) => {
          if (!guards['valueIsNumber']({ context, event })) {
            return;
          }
          enq((actionArgs) => actions['onChangeC'](actionArgs as any));
          return { target: 'ready' };
        },
        changeF: ({ context, event, guards, actions }, enq) => {
          if (!guards['valueIsNumber']({ context, event })) {
            return;
          }
          enq((actionArgs) => actions['onChangeF'](actionArgs as any));
          return { target: 'ready' };
        }
      }
    }
  }
});
