import { setup, types } from 'xstate';

export type ModalId = 'sheet' | 'form' | 'confirm';

export interface ModalEntry {
  modal: ModalId;
  /** DOM id of the element that had focus when this modal was opened. */
  returnFocusTo: string | null;
}

/**
 * The modal stack lives in context. Only the topmost entry is interactive, and
 * `close` pops exactly one level, so nested dialogs unwind in order.
 */
export const modalMachine = setup({
  schemas: {
    context: types<{ stack: ModalEntry[] }>(),
    events: {
      open: types<{ modal: ModalId; returnFocusTo: string | null }>(),
      close: types<{}>()
    }
  }
}).createMachine({
  id: 'modals',
  context: {
    stack: []
  },
  on: {
    open: ({ context, event }) => ({
      context: {
        stack: context.stack.concat({
          modal: event.modal,
          returnFocusTo: event.returnFocusTo
        })
      }
    }),
    close: ({ context }) => {
      if (!context.stack.length) {
        return;
      }

      return { context: { stack: context.stack.slice(0, -1) } };
    }
  }
});
