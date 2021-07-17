import { assign } from 'xstate';
import { createModel } from 'xstate/lib/model';

const createFieldModel = <T>(initialValue: T) =>
  createModel(
    {
      initialValue,
      value: initialValue
    },
    {
      events: {
        touch: (touched: boolean) => ({ touched }),
        focus: () => ({}),
        blur: () => ({}),
        change: (value: T) => ({ value })
      }
    }
  );

const createFieldMachine = <T>(initialValue: T) =>
  createFieldModel(initialValue).createMachine({});

const friendModel = createModel(
  {
    name: '',
    email: ''
  },
  {
    events: {
      SET_NAME: (value: string) => ({ value }),
      SET_EMAIL: (value: string) => ({ value }),
      SAVE: () => ({}),
      EDIT: () => ({})
    }
  }
);

export const friendMachine = friendModel.createMachine({
  context: {
    name: '',
    email: ''
  },
  initial: 'reading',
  states: {
    reading: {
      on: {
        EDIT: 'editing'
      }
    },
    editing: {
      tags: 'form',
      on: {
        SET_NAME: {
          actions: assign({ name: (_, e) => e.value })
        },
        SET_EMAIL: {
          actions: assign({ email: (_, e) => e.value })
        },
        SAVE: {
          target: 'saving'
        }
      }
    },
    saving: {
      tags: 'form',
      entry: (ctx) => console.log(ctx),
      after: {
        1000: 'reading'
      }
    }
  }
});
