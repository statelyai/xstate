import * as React from 'react';
import { render } from '@testing-library/react';
import { Machine, interpret, assign, createMachine, State } from 'xstate';
import { useService, useMachine, useActor } from '../src';
import { ActorRef } from 'xstate/src/Actor';

describe('useService', () => {
  it('should accept spawned machine', () => {
    interface TodoCtx {
      completed: boolean;
    }
    interface TodosCtx {
      todos: Array<ActorRef<any, State<TodoCtx, any>>>;
    }

    const todoMachine = Machine<TodoCtx>({
      context: {
        completed: false
      },
      initial: 'uncompleted',
      states: {
        uncompleted: {
          on: {
            COMPLETE: 'done'
          }
        },
        done: {
          entry: assign<TodoCtx>({ completed: true })
        }
      }
    });

    const todosMachine = Machine<TodosCtx, any, { type: 'CREATE' }>({
      context: { todos: [] },
      initial: 'working',
      states: { working: {} },
      on: {
        CREATE: {
          actions: assign((ctx, _, { spawn }) => ({
            ...ctx,
            todos: ctx.todos.concat(spawn.from(todoMachine))
          }))
        }
      }
    });

    const service = interpret(todosMachine).start();

    const Todo = ({ index }: { index: number }) => {
      const [current] = useService(service);
      const todoRef = current.context.todos[index];
      const [todoCurrent] = useActor(todoRef);
      return <>{todoCurrent.context.completed}</>;
    };

    service.send('CREATE');

    render(<Todo index={0} />);
  });
});

describe('useMachine', () => {
  it('should preserve typestate information.', () => {
    type YesNoContext = { value?: number };

    type YesNoEvent = { type: 'YES' };

    type YesNoTypestate =
      | { value: 'no'; context: { value: undefined } }
      | { value: 'yes'; context: { value: number } };

    const yesNoMachine = createMachine<
      YesNoContext,
      YesNoEvent,
      YesNoTypestate
    >({
      context: {
        value: undefined
      },
      initial: 'no',
      states: {
        no: {
          on: {
            YES: 'yes'
          }
        },
        yes: {
          type: 'final'
        }
      }
    });

    const YesNo = () => {
      const [state] = useMachine(yesNoMachine);

      if (state.matches('no')) {
        const undefinedValue: undefined = state.context.value;

        return <span>{undefinedValue ? 'Yes' : 'No'}</span>;
      } else if (state.matches('yes')) {
        const numericValue: number = state.context.value;

        return <span>{numericValue ? 'Yes' : 'No'}</span>;
      }

      return <span>No</span>;
    };

    render(<YesNo />);
  });
});
