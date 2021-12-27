import { sendParent } from 'xstate';
import { createModel } from 'xstate/lib/model';

const todoModel = createModel(
  {
    id: '',
    title: '',
    prevTitle: '',
    completed: false
  },
  {
    events: {
      TOGGLE_COMPLETE: () => ({}),
      DELETE: () => ({}),
      SET_COMPLETED: () => ({}),
      SET_ACTIVE: () => ({}),
      EDIT: () => ({}),
      CHANGE: (value: string) => ({ value }),
      COMMIT: () => ({}),
      BLUR: () => ({}),
      CANCEL: () => ({})
    }
  }
);

export const createTodoMachine = ({
  id,
  title,
  completed
}: {
  id: string;
  title: string;
  completed: boolean;
}) => {
  return todoModel.createMachine(
    {
      id: 'todo',
      initial: 'reading',
      context: {
        id,
        title,
        prevTitle: title,
        completed
      },
      on: {
        TOGGLE_COMPLETE: {
          actions: [
            todoModel.assign({ completed: true }),
            sendParent((context) => ({ type: 'TODO.COMMIT', todo: context }))
          ]
        },
        DELETE: 'deleted'
      },
      states: {
        reading: {
          on: {
            SET_COMPLETED: {
              actions: [todoModel.assign({ completed: true }), 'commit']
            },
            TOGGLE_COMPLETE: {
              actions: [
                todoModel.assign({
                  completed: (context) => !context.completed
                }),
                'commit'
              ]
            },
            SET_ACTIVE: {
              actions: [todoModel.assign({ completed: false }), 'commit']
            },
            EDIT: {
              target: 'editing',
              actions: 'focusInput'
            }
          }
        },
        editing: {
          entry: todoModel.assign({ prevTitle: (context) => context.title }),
          on: {
            CHANGE: {
              actions: todoModel.assign({
                title: (_, event) => event.value
              })
            },
            COMMIT: [
              {
                target: 'reading',
                actions: sendParent((context) => ({
                  type: 'TODO.COMMIT',
                  todo: context
                })),
                cond: (context) => context.title.trim().length > 0
              },
              { target: 'deleted' }
            ],
            BLUR: {
              target: 'reading',
              actions: sendParent((context) => ({
                type: 'TODO.COMMIT',
                todo: context
              }))
            },
            CANCEL: {
              target: 'reading',
              actions: todoModel.assign({
                title: (context) => context.prevTitle
              })
            }
          }
        },
        deleted: {
          entry: sendParent((context) => ({
            type: 'TODO.DELETE',
            id: context.id
          }))
        }
      }
    },
    {
      actions: {
        commit: sendParent((context) => ({
          type: 'TODO.COMMIT',
          todo: context
        })),
        focusInput: () => {}
      }
    }
  );
};
