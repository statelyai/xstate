import { createCallbackLogic, setup, types } from 'xstate';

/**
 * Mock upload transport: reports progress every 200ms and either completes or
 * fails partway through.
 */
const uploadTransport = createCallbackLogic({
  schemas: { input: types<{ willFail: boolean }>() },
  run: ({ sendBack, input }) => {
    let progress = 0;

    const interval = setInterval(() => {
      progress += 10;

      if (input.willFail && progress >= 50) {
        sendBack({ type: 'FAILED' });
        return;
      }

      if (progress >= 100) {
        sendBack({ type: 'PROGRESS', progress: 100 });
        sendBack({ type: 'COMPLETED' });
        return;
      }

      sendBack({ type: 'PROGRESS', progress });
    }, 200);

    return () => clearInterval(interval);
  }
});

export const uploadMachine = setup({
  schemas: {
    context: types<{
      name: string;
      willFail: boolean;
      progress: number;
    }>(),
    input: types<{ name: string; willFail: boolean }>(),
    events: {
      PROGRESS: types<{ progress: number }>(),
      COMPLETED: types<{}>(),
      FAILED: types<{}>(),
      CANCEL: types<{}>(),
      RETRY: types<{}>()
    }
  },
  actors: { uploadTransport }
}).createMachine({
  id: 'upload',
  initial: 'uploading',
  context: ({ input }) => ({
    name: input.name,
    willFail: input.willFail,
    progress: 0
  }),
  states: {
    uploading: {
      invoke: {
        src: 'uploadTransport',
        input: ({ context }) => ({ willFail: context.willFail })
      },
      on: {
        PROGRESS: ({ context, event }) => ({
          context: { ...context, progress: event.progress }
        }),
        COMPLETED: { target: 'done' },
        FAILED: { target: 'failed' },
        CANCEL: { target: 'cancelled' }
      }
    },
    done: {},
    failed: {
      on: {
        // Retrying succeeds: the file is no longer marked as failing
        RETRY: ({ context }) => ({
          target: 'uploading',
          context: { ...context, willFail: false, progress: 0 }
        })
      }
    },
    cancelled: {}
  }
});
