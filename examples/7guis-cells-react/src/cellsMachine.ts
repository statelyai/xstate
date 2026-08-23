import { setup, types } from 'xstate';
import { evaluateAll, type CellMap } from './formula';

/** A-H by 1-15. The 7GUIs task allows up to 26x100; this is cut for legibility. */
export const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export const ROWS = Array.from({ length: 15 }, (_, index) => index + 1);

interface CellsContext {
  /** Raw cell input, keyed by name (`A1`). Formulas keep their leading `=`. */
  cells: CellMap;
  /** Computed display values, recomputed after every commit. */
  values: Record<string, string>;
  /** The cell being edited, or `null`. */
  editing: string | null;
  draft: string;
}

const initialCells: CellMap = {
  A1: '2',
  A2: '3',
  B1: '=A1+A2',
  B2: '=B1*2',
  C1: '=SUM(A1:B2)'
};

export const cellsMachine = setup({
  schemas: {
    context: types<CellsContext>(),
    events: {
      edit: types<{ cell: string }>(),
      draft: types<{ value: string }>(),
      commit: types<{}>(),
      cancel: types<{}>()
    }
  },
  guards: {
    // Standalone, args-first: takes only the cell name it validates.
    isEditing: (editing: string | null): editing is string => editing !== null
  }
}).createMachine({
  id: 'cells',
  context: {
    cells: initialCells,
    values: evaluateAll(initialCells),
    editing: null,
    draft: ''
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        edit: ({ context, event }) => ({
          target: 'editing',
          context: {
            editing: event.cell,
            draft: context.cells[event.cell] ?? ''
          }
        })
      }
    },
    editing: {
      on: {
        draft: ({ event }) => ({ context: { draft: event.value } }),
        cancel: { target: 'idle', context: { editing: null, draft: '' } },
        // Committing recomputes the whole sheet, so every cell that depends
        // on the edited one — directly or transitively — updates at once.
        commit: ({ context, guards }) => {
          if (!guards.isEditing(context.editing)) {
            return;
          }

          const cells = { ...context.cells, [context.editing]: context.draft };

          return {
            target: 'idle',
            context: {
              cells,
              values: evaluateAll(cells),
              editing: null,
              draft: ''
            }
          };
        }
      }
    }
  }
});
