import { createMachine, assign } from 'xstate';

export const friendMachine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QDMBOBLMA7CA6VYAhhOllAMQCiAIgJIAqA2gAwC6ioADgPazoAu6blg4gAHogAsAdmm4ArAEYAHNMkA2SQE4ATJOUBmLeoA0IAJ5SVuZVrtb509c3WKt0gwF9PZtJhy4kAKkFADKlPQA+gByAIIAspQs7EggPHyCwqISCAbqWrgqag75zLLMkvJmlgjqqgr2WpLMzO4GBjrevhjYeEGCZOShsQBqSWyi6cFZqTlO8rgG2nbq6nkuOsrViNKKcrb2OtIOm8ryXSB+vbiwhABuIeRisPyE-GC4hMjvqAAUii1mABKchXAK3B5kZKTXjTESzRCuSS4OrFHS6VbMKoWRAGZTKBr2fLSeQuSReHyXHo4cgAYVi0VplAAMtDUlNMvDQDk8QsjujFM55A47PJJNsELZCY1mkZ5AZzhcsNwIHBRGCIDCMkIueJcTpFIVVNp5KVytiaopDY0bTaKd1-HgCMQQlq4dkpCSbFpBeo9DoKqbTRK9MxCo18ooxcK6hcNYESAMoG7OR6EJU5EdlvIdHVc4GJfKCm57HLmIpNuo49S8BDXezYamEQg1MjhTL8UYFRLDASS3ZWsoZO5Fd4gA */
  id: 'friend',
  types: {} as {
    context: {
      prevName: string;
      name: string;
    };
    events:
      | {
          type: 'SET_NAME';
          value: string;
        }
      | {
          type: 'SAVE';
        }
      | {
          type: 'EDIT';
        }
      | {
          type: 'CANCEL';
        };
    // TODO: input
  },
  initial: 'reading',
  context: ({ input }) => ({
    prevName: input.name,
    name: input.name
  }),
  states: {
    reading: {
      tags: 'read',
      on: {
        EDIT: 'editing'
      }
    },
    editing: {
      tags: 'form',
      on: {
        SET_NAME: {
          actions: assign({ name: ({ event }) => event.value })
        },
        SAVE: {
          target: 'saving'
        }
      }
    },
    saving: {
      tags: ['form', 'saving'],
      after: {
        // Simulate network request
        1000: {
          target: 'reading',
          actions: assign({ prevName: ({ context }) => context.name })
        }
      }
    }
  },
  on: {
    CANCEL: {
      actions: assign({ name: ({ context }) => context.prevName }),
      target: '.reading'
    }
  }
});
