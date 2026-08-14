import { createStore } from '@xstate/store';
import { undoRedo } from '@xstate/store/undo';

export interface Dot {
  x: number;
  y: number;
  color: string;
}

const COLORS = ['#9fb4ff', '#ffb4a2', '#a2ffb4', '#ffe6a2'];

/**
 * `.with(undoRedo(...))` wraps the store logic and adds `undo` and `redo`
 * events. The `snapshot` strategy keeps whole past/future snapshots on the
 * store snapshot, so undoing is a restore rather than a replay.
 */
export const drawingStore = createStore({
  context: { dots: [] as Dot[], strokes: 0 },
  on: {
    draw: (context, event: { x: number; y: number }) => ({
      dots: [
        ...context.dots,
        {
          x: event.x,
          y: event.y,
          color: COLORS[context.strokes % COLORS.length]
        }
      ],
      strokes: context.strokes + 1
    }),
    clear: () => ({ dots: [], strokes: 0 })
  }
}).with(undoRedo({ strategy: 'snapshot', historyLimit: 50 }));

export interface UndoRedoHistory {
  past: unknown[];
  future: unknown[];
}

/**
 * The snapshot strategy puts `past` and `future` on the store snapshot, but
 * `.with(undoRedo(...))` does not widen the snapshot type yet, so the history
 * is read through this helper.
 */
export function historyOf(snapshot: object): UndoRedoHistory {
  return snapshot as UndoRedoHistory;
}
