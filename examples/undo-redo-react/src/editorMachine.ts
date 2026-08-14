import { setup, types } from 'xstate';

/** Maximum number of snapshots kept in the past stack. */
const HISTORY_LIMIT = 20;

/** Milliseconds of typing inactivity before an edit burst is committed. */
const QUIET_MS = 700;

interface EditorContext {
  past: string[];
  present: string;
  future: string[];
}

const pushCapped = (stack: string[], value: string) =>
  stack.concat(value).slice(-HISTORY_LIMIT);

export const editorMachine = setup({
  schemas: {
    context: types<EditorContext>(),
    events: {
      type: types<{ value: string }>(),
      undo: types<{}>(),
      redo: types<{}>()
    }
  },
  delays: {
    quiet: QUIET_MS
  }
}).createMachine({
  id: 'editor',
  context: {
    past: [],
    present: '',
    future: []
  },
  initial: 'idle',
  states: {
    // No edit in flight: the next keystroke opens a new undo entry.
    idle: {
      on: {
        type: ({ context, event }) => ({
          target: 'editing',
          context: {
            // The value before the burst is what `undo` will restore.
            past: pushCapped(context.past, context.present),
            present: event.value,
            future: []
          }
        })
      }
    },
    // An edit burst is in flight. Every keystroke re-enters this state, which
    // restarts the `quiet` timer, so consecutive typing stays one undo entry.
    editing: {
      after: {
        quiet: { target: 'idle' }
      },
      on: {
        type: ({ event }) => ({
          target: 'editing',
          reenter: true,
          context: {
            present: event.value,
            future: []
          }
        })
      }
    }
  },
  on: {
    undo: ({ context }) => {
      if (!context.past.length) {
        return;
      }

      return {
        // Leaving `editing` closes the burst, so the next keystroke starts
        // a fresh undo entry.
        target: '.idle',
        context: {
          past: context.past.slice(0, -1),
          present: context.past[context.past.length - 1],
          future: [context.present, ...context.future]
        }
      };
    },
    redo: ({ context }) => {
      if (!context.future.length) {
        return;
      }

      return {
        target: '.idle',
        context: {
          past: pushCapped(context.past, context.present),
          present: context.future[0],
          future: context.future.slice(1)
        }
      };
    }
  }
});
