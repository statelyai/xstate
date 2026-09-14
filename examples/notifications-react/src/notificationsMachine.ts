import { ActorFromLogic, setup, types } from 'xstate';
import { toastMachine, ToastKind, ToastSpec } from './toastMachine';

/** How many toasts may be on screen at once. The rest wait in `queue`. */
const MAX_VISIBLE = 3;

let count = 0;
const nextId = () => `toast-${++count}`;

interface NotificationsContext {
  visible: ActorFromLogic<typeof toastMachine>[];
  queue: ToastSpec[];
}

export const notificationsMachine = setup({
  schemas: {
    context: types<NotificationsContext>(),
    events: {
      push: types<{ kind: ToastKind; message: string }>(),
      dismissed: types<{ id: string }>()
    }
  }
}).createMachine({
  id: 'notifications',
  context: {
    visible: [],
    queue: []
  },
  on: {
    push: ({ context, event }, enq) => {
      const spec: ToastSpec = {
        id: nextId(),
        kind: event.kind,
        message: event.message
      };

      if (context.visible.length >= MAX_VISIBLE) {
        return { context: { queue: context.queue.concat(spec) } };
      }

      const toast = enq.spawn(toastMachine, { id: spec.id, input: spec });

      // The parent learns about dismissal from the child's final output,
      // whichever way the child got there (timer or manual dismiss).
      enq.subscribeTo(toast, {
        done: (output) => ({ type: 'dismissed' as const, id: output.id })
      });

      return { context: { visible: context.visible.concat(toast) } };
    },
    dismissed: ({ context, event }, enq) => {
      const visible = context.visible.filter(
        (toast) => toast.getSnapshot().context.id !== event.id
      );

      const [next, ...queue] = context.queue;

      if (!next) {
        return { context: { visible } };
      }

      // A slot freed up: promote the oldest queued toast.
      const toast = enq.spawn(toastMachine, { id: next.id, input: next });

      enq.subscribeTo(toast, {
        done: (output) => ({ type: 'dismissed' as const, id: output.id })
      });

      return { context: { visible: visible.concat(toast), queue } };
    }
  }
});
