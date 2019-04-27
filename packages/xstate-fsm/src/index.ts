export function FSM(fsmConfig: any) {
  return {
    transition: (
      state: string | { value: string; context: any },
      event: string | Record<string, any> & { type: string }
    ) => {
      const { value, context } =
        typeof state === 'string'
          ? { value: state, context: fsmConfig.context }
          : state;
      const eventObject = typeof event === 'string' ? { type: event } : event;
      const stateConfig = fsmConfig.states[value];

      if (stateConfig.on) {
        const transitions = [].concat(stateConfig.on[eventObject.type]);

        for (const transition of transitions) {
          if (transition === undefined) {
            return { value };
          }

          const { target, actions = [], cond = () => true } =
            typeof transition === 'string'
              ? { target: transition }
              : transition;

          if (cond(context)) {
            const nextStateConfig = fsmConfig.states[value];
            const allActions = []
              .concat(stateConfig.exit)
              .concat(actions)
              .concat(nextStateConfig.entry)
              .filter(Boolean);
            return { value: target, context, actions: allActions };
          }
        }

        return {
          value,
          context
        };
      }
    }
  };
}

const lightMachine = FSM({
  initial: 'green',
  context: { count: 10 },
  states: {
    green: {
      entry: 'foo',
      on: {
        TIMER: 'yellow'
      }
    },
    yellow: {
      entry: 'bar',
      on: {
        TIMER: [
          {
            target: 'red',
            actions: ['yellowaction1', 'yellowaction2'],
            cond: ctx => ctx.count > 1
          },
          'green'
        ]
      },
      exit: 'barexit'
    },
    red: {
      entry: 'baz',
      on: {
        TIMER: 'green'
      }
    }
  }
});

const s1 = lightMachine.transition('green', 'TIMER');
console.log(s1);
const s2 = lightMachine.transition(s1, { type: 'TIMER' });
console.log(s2);
