import * as React from 'react';
import { render } from '@testing-library/react';
import { Machine, interpret, assign, spawn, Interpreter } from 'xstate';
import { useService } from '../src';

describe('useService', () => {
  it('should accept spawned machine', () => {
    interface TodoCtx {
      completed: boolean;
    }
    interface TodosCtx {
      todos: Array<Interpreter<TodoCtx>>;
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
          entry: assign({ completed: true })
        }
      }
    });

    const todosMachine = Machine<TodosCtx, { type: 'CREATE' }>({
      context: { todos: [] },
      initial: 'working',
      states: { working: {} },
      on: {
        CREATE: {
          actions: assign(ctx => ({
            ...ctx,
            todos: ctx.todos.concat(spawn(todoMachine) as Interpreter<TodoCtx>)
          }))
        }
      }
    });

    const service = interpret(todosMachine).start();

    const Todo = ({ index }: { index: number }) => {
      const [current] = useService(service);
      const todoRef = current.context.todos[index];
      const [todoCurrent] = useService(todoRef);
      return <>{todoCurrent.context.completed}</>;
    };

    service.send('CREATE');

    render(<Todo index={0} />);
  });
});
