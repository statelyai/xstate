import {
  ActorLogic,
  AnyActorLogic,
  EventFrom,
  InputFrom,
  SnapshotFrom,
  assign,
  setup
} from 'xstate';

export const machine = setup({
  types: {
    context: {} as {
      items: string[];
    },
    events: {} as {
      type: 'item.add';
      item: string;
    }
  }
}).createMachine({
  context: {
    items: []
  },
  on: {
    'item.add': {
      actions: assign({
        items: ({ context, event }) => {
          return [...context.items, event.item];
        }
      })
    }
  }
});

type ActorLogicWithUndoRedo<T extends AnyActorLogic> = ActorLogic<
  SnapshotFrom<T> & {
    undoStack: SnapshotFrom<T>[];
    redoStack: SnapshotFrom<T>[];
  },
  EventFrom<T> | { type: 'undo' } | { type: 'redo' },
  InputFrom<T>,
  any
>;

export function withUndoRedo<T extends AnyActorLogic>(
  logic: T
): ActorLogicWithUndoRedo<T> {
  return {
    ...logic,
    transition(snapshot, event, actorScope) {
      if (event.type === 'undo') {
        const previousSnapshot = snapshot.undoStack.pop();

        if (previousSnapshot) {
          return {
            ...previousSnapshot,
            undoStack: snapshot.undoStack,
            redoStack: [snapshot, ...snapshot.redoStack]
          };
        }

        return snapshot;
      }
      if (event.type === 'redo') {
        const nextSnapshot = snapshot.redoStack.pop();
        if (nextSnapshot) {
          return {
            ...nextSnapshot,
            undoStack: [...snapshot.undoStack, snapshot],
            redoStack: snapshot.redoStack
          };
        }

        return snapshot;
      }

      const nextSnapshot = logic.transition(snapshot, event, actorScope);

      return {
        ...nextSnapshot,
        undoStack: [...snapshot.undoStack, snapshot],
        redoStack: []
      };
    },
    getInitialSnapshot(...args) {
      return {
        ...logic.getInitialSnapshot(...args),
        undoStack: [],
        redoStack: []
      };
    }
  } satisfies ActorLogicWithUndoRedo<T>;
}
