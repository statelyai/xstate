import { assign } from 'xstate';
import { createModel } from 'xstate/lib/model';

const createFieldModel = <T>(initialValue: T) =>
  createModel(
    {
      initialValue,
      previousValue: initialValue,
      value: initialValue
    },
    {
      events: {
        touch: (touched: boolean) => ({ touched }),
        focus: () => ({}),
        blur: () => ({}),
        change: (value: T) => ({ value }),
        commit: () => ({}),
        cancel: () => ({}),
        reset: () => ({})
      }
    }
  );

const createFieldMachine = <T>(initialValue: T) => {
  const fieldModel = createFieldModel(initialValue);
  return fieldModel.createMachine({
    on: {
      change: {
        actions: fieldModel.assign({
          value: (_, e) => e.value
        })
      },
      commit: {
        actions: fieldModel.assign({
          previousValue: (ctx) => ctx.value
        })
      },
      cancel: {
        actions: fieldModel.assign({
          value: (ctx) => ctx.previousValue
        })
      },
      reset: {
        actions: fieldModel.reset()
      }
    }
  });
};

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
      EDIT: () => ({}),
      CANCEL: () => ({})
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
        },
        CANCEL: {
          target: 'reading'
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
