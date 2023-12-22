import { assign, createMachine, fromCallback } from 'xstate';

export const stopwatchMachine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBED2ACAdqgLu2OqADgO4CGOAxgBYB0BxRkAxAWQE44DaADALqJQRVLACWOUakyCQAD0QBWACwB2WgoCMAJgU8AbEoDMWgwoA0IAJ6JDKhbSUBOZ472GlGlQccBfHxbQsXHxCUgoaWnYAV0xMUUwoZgAVAEkAYQBpXgEkEGExCSkZeQQNHg17AA5Kux5KhRUtSq0lC2sEQ21aN0NejW0eTR5ffxBA7DwGMKpqZnY4MG5+GXzxSWlckr0eNptDStoTPWPDRyVVLW0-UewIOBlx4KnyGZWRNaLNxG1dhBbaMoeBRaLQqQaOLRnSp+AIYCYhYgvCJTJgQN4FdbFRBKHhaWiGXQ8YwmVT7SqtKzfFRqHg8IEg3ruWkKGFjOFPUJIujRWLxKDoj4bUBbY60FQ1XR6CF6FoKRy-SF6WiVRmGOqkkEjPxAA */
  id: "Do not stopwatch",
  initial: 'stopped',
  context: {
    elapsed: 0
  },
  states: {
    stopped: {
      on: {
        start: 'running'
      }
    },
    running: {
      invoke: {
        src: fromCallback((sendBack) => {
          const interval = setInterval(() => {
            sendBack({ type: 'TICK' });
          }, 10);
          return () => clearInterval(interval);
        })
      },
      on: {
        TICK: {
          actions: assign({
            elapsed: ({ context }) => context.elapsed + 1
          })
        }
      }
    }
  },
  on: {
    reset: {
      actions: assign({
        elapsed: 0
      }),
      target: '.stopped'
    }
  }
});
