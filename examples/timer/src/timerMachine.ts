import { createMachine, createCallbackLogic } from 'xstate';

export const timerMachine = createMachine({
  actorSources: {
    ticks: createCallbackLogic(({ sendBack }) => {
      const interval = setInterval(() => {
        sendBack({ type: 'TICK' });
      }, 1000);
      return () => clearInterval(interval);
    })
  },
  types: {} as {
    events:
      | { type: 'start' }
      | { type: 'stop' }
      | { type: 'reset' }
      | { type: 'minute' }
      | { type: 'second' }
      | { type: 'TICK' };
  },
  context: {
    seconds: 0
  },
  initial: 'stopped',
  states: {
    stopped: {
      on: {
        start: ({ context, event, guards, actions }, enq) => {
          if (!(({ context }) => context.seconds > 0)({ context, event })) {
            return;
          }
          return { target: 'running' };
        },
        minute: ({ context, event, guards, actions }, enq) => {
          return {
            context: {
              ...context,
              seconds: (({ context }) => context.seconds + 60)({
                context: context,
                event: event
              })
            }
          };
        },
        second: ({ context, event, guards, actions }, enq) => {
          return {
            context: {
              ...context,
              seconds: (({ context }) => context.seconds + 1)({
                context: context,
                event: event
              })
            }
          };
        }
      }
    },
    running: {
      invoke: {
        src: 'ticks'
      },
      on: {
        stop: 'stopped',
        TICK: ({ context, event, guards, actions }, enq) => {
          return {
            context: {
              ...context,
              seconds: (({ context }) => context.seconds - 1)({
                context: context,
                event: event
              })
            }
          };
        }
      },
      always: ({ context, event, guards, actions }, enq) => {
        if (!(({ context }) => context.seconds === 0)({ context, event })) {
          return;
        }
        return { target: 'stopped' };
      }
    }
  },
  on: {
    reset: ({ context, event, guards, actions }, enq) => {
      if (!(({ context }) => context.seconds > 0)({ context, event })) {
        return;
      }
      return { context: { ...context, seconds: 0 } };
    }
  }
});
