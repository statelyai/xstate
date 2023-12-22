import { assign, createMachine, fromCallback } from 'xstate';

export const stopwatchMachine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QDsD2AXABLdqAOA7gIboDGAFgHQ756QDEORATugNoAMAuoqHqrACW6QamS8QAD0QBWACwB2SjICMAJhkcAbHIDManTIA0IAJ6JdCmZTkBOe7a265KhTtsBfDybRYahEgpKZgBXZGRBZCh6ABUASQBhAGlOHiQQfiERMQlpBBUOFWsADmKrDmKZBTVitTkTcwRddUonXXaVdQ5VDk9vEF9sXACycnpmODB2bglM4VFxdLytDgaLXWLKAy0d3Vs5RTV1L360CDgJQf9iUdmBeZylxHU1-P1lB3sFB2K7FS8fBghvgbkF-HQIHcsgtcog5NotloNBwFN81JYZLZXrotEo3DstEVbKjSnIAQMgddAlRQuFIlAoQ9FqBljtKAoypotLYDHVMa81I5KMV2u0Kop9IKTh4gA */
  id: "not stopwatch",
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
