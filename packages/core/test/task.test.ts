import { createMachine, interpret } from '../src';
import { spawnPromise } from '../src/invoke';

describe('task state node', () => {
  const taskMachine = createMachine({
    initial: 'first',
    context: {
      error: false
    },
    states: {
      first: {
        type: 'task',
        src: spawnPromise(
          ctx =>
            new Promise((res, rej) => {
              setTimeout(() => {
                ctx.error ? rej('Error!') : res(42);
              }, 50);
            })
        ),
        onDone: {
          target: 'success',
          cond: (_, e) => e.data === 42
        },
        onError: {
          target: 'failure'
        },
        on: {
          INTERRUPT: 'interrupted'
        }
      },
      success: {
        type: 'final'
      },
      interrupted: {
        type: 'final'
      },
      failure: {
        type: 'final'
      }
    }
  });

  it('should complete the task', done => {
    const service = interpret(taskMachine)
      .onDone(() => {
        expect(service.state.matches('success')).toBeTruthy();
        done();
      })
      .start();
  });

  it('the task should be failable', done => {
    const service = interpret(taskMachine.withContext({ error: true }))
      .onDone(() => {
        expect(service.state.matches('failure')).toBeTruthy();
        done();
      })
      .start();
  });

  it('the task should be interruptible', done => {
    const service = interpret(taskMachine)
      .onDone(() => {
        expect(service.state.matches('interrupted')).toBeTruthy();
        done();
      })
      .start();

    service.send('INTERRUPT');
  });
});
