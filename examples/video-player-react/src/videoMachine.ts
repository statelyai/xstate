import { createAsyncLogic, createCallbackLogic, setup, types } from 'xstate';

const DURATION = 30;

export const videoMachine = setup({
  schemas: {
    context: types<{ currentTime: number; duration: number }>(),
    events: {
      PLAY: types<{}>(),
      PAUSE: types<{}>(),
      SEEK: types<{ time: number }>(),
      STALL: types<{}>(),
      REPLAY: types<{}>(),
      TICK: types<{}>()
    }
  },
  actors: {
    loadMetadata: createAsyncLogic({
      run: async () => {
        // Stands in for the `loadedmetadata` event of a real <video> element
        await new Promise((resolve) => setTimeout(resolve, 800));
        return { duration: DURATION };
      }
    }),
    playbackClock: createCallbackLogic(({ sendBack }) => {
      const interval = setInterval(() => sendBack({ type: 'TICK' }), 1000);

      return () => clearInterval(interval);
    })
  },
  delays: {
    bufferRefill: 1500
  }
}).createMachine({
  id: 'video',
  initial: 'loading',
  context: { currentTime: 0, duration: DURATION },
  states: {
    loading: {
      invoke: {
        src: 'loadMetadata',
        onDone: ({ event }) => ({
          target: 'ready',
          context: { duration: event.output.duration }
        })
      }
    },
    ready: {
      initial: 'paused',
      states: {
        paused: {
          on: {
            PLAY: { target: 'playing' }
          }
        },
        playing: {
          invoke: { src: 'playbackClock' },
          on: {
            PAUSE: { target: 'paused' },
            STALL: { target: 'buffering' },
            TICK: ({ context }) => ({
              context: { currentTime: context.currentTime + 1 }
            })
          },
          always: ({ context }) => {
            if (context.currentTime < context.duration) {
              return;
            }

            return { target: 'ended' };
          }
        },
        buffering: {
          // A real player would leave this state on the `playing` media event
          after: { bufferRefill: { target: 'playing' } },
          on: {
            PAUSE: { target: 'paused' }
          }
        },
        ended: {
          on: {
            REPLAY: () => ({
              target: 'playing',
              context: { currentTime: 0 }
            }),
            SEEK: ({ event }) => ({
              target: 'paused',
              context: { currentTime: Math.max(event.time, 0) }
            })
          }
        }
      },
      on: {
        SEEK: ({ context, event }) => ({
          context: {
            currentTime: Math.min(Math.max(event.time, 0), context.duration)
          }
        })
      }
    }
  }
});
