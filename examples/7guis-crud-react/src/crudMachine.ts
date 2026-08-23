import { setup, types } from 'xstate';

export interface Entry {
  id: string;
  name: string;
  surname: string;
}

interface CrudContext {
  entries: Entry[];
  /** `null` when nothing in the list is selected. */
  selectedId: string | null;
  /** Prefix matched against the surname. */
  filter: string;
  nameDraft: string;
  surnameDraft: string;
}

let nextId = 0;
const createId = () => `entry-${nextId++}`;

const initialEntries: Entry[] = [
  { id: createId(), name: 'Hans', surname: 'Emil' },
  { id: createId(), name: 'Max', surname: 'Mustermann' },
  { id: createId(), name: 'Roman', surname: 'Tisch' }
];

export const matchesFilter = (entry: Entry, filter: string) =>
  entry.surname.toLowerCase().startsWith(filter.trim().toLowerCase());

export const crudMachine = setup({
  schemas: {
    context: types<CrudContext>(),
    events: {
      filter: types<{ value: string }>(),
      name: types<{ value: string }>(),
      surname: types<{ value: string }>(),
      select: types<{ id: string }>(),
      create: types<{}>(),
      update: types<{}>(),
      delete: types<{}>()
    }
  },
  guards: {
    // Standalone, args-first: each guard takes only the value it judges.
    hasSelection: (selectedId: string | null) => selectedId !== null,
    isNamed: ({ name, surname }: { name: string; surname: string }) =>
      name.trim().length > 0 || surname.trim().length > 0
  }
}).createMachine({
  id: 'crud',
  context: {
    entries: initialEntries,
    selectedId: null,
    filter: '',
    nameDraft: '',
    surnameDraft: ''
  },
  on: {
    filter: ({ event }) => ({ context: { filter: event.value } }),
    name: ({ event }) => ({ context: { nameDraft: event.value } }),
    surname: ({ event }) => ({ context: { surnameDraft: event.value } }),

    // Selecting loads the entry into the drafts, so `update` edits it in place.
    select: ({ context, event }) => {
      const entry = context.entries.find(({ id }) => id === event.id);

      if (!entry) {
        return;
      }

      return {
        context: {
          selectedId: entry.id,
          nameDraft: entry.name,
          surnameDraft: entry.surname
        }
      };
    },

    create: ({ context, guards }) => {
      if (
        !guards.isNamed({
          name: context.nameDraft,
          surname: context.surnameDraft
        })
      ) {
        return;
      }

      return {
        context: {
          entries: context.entries.concat({
            id: createId(),
            name: context.nameDraft,
            surname: context.surnameDraft
          })
        }
      };
    },

    update: ({ context, guards }) => {
      if (
        !guards.hasSelection(context.selectedId) ||
        !guards.isNamed({
          name: context.nameDraft,
          surname: context.surnameDraft
        })
      ) {
        return;
      }

      return {
        context: {
          entries: context.entries.map((entry) =>
            entry.id === context.selectedId
              ? {
                  ...entry,
                  name: context.nameDraft,
                  surname: context.surnameDraft
                }
              : entry
          )
        }
      };
    },

    delete: ({ context, guards }) => {
      if (!guards.hasSelection(context.selectedId)) {
        return;
      }

      return {
        context: {
          entries: context.entries.filter(
            (entry) => entry.id !== context.selectedId
          ),
          selectedId: null,
          nameDraft: '',
          surnameDraft: ''
        }
      };
    }
  }
});
