import { createMachine, interpret } from 'xstate';
import { receiveTask, task, sequence, exclusive } from '../src';

describe('@xstate/flow', () => {
  it('should create a task', (done) => {
    const machine = createMachine(
      {
        initial: 'first',
        states: {
          first: {
            ...task('someTask'),
            onDone: 'success'
          },
          success: {
            type: 'final'
          }
        }
      },
      {
        services: {
          someTask: () => {
            return Promise.resolve(true);
          }
        }
      }
    );

    interpret(machine)
      .onDone(() => {
        done();
      })
      .start();
  });

  it('should create a receive task', (done) => {
    const machine = createMachine(
      {
        initial: 'first',
        states: {
          first: {
            ...receiveTask('someEvent'),
            onDone: 'success'
          },
          success: {
            type: 'final'
          }
        }
      },
      {
        services: {
          someTask: () => {
            return Promise.resolve(true);
          }
        }
      }
    );

    interpret(machine)
      .onDone(() => {
        done();
      })
      .start()
      .send('someEvent');
  });

  it('should do a process', (done) => {
    const p = sequence(
      task('scan invoice'),
      task('archive original'),
      receiveTask('approver received'),
      task('assign approver'),
      ...exclusive(
        // [after('7 days'), finish()],
        [{ event: 'invoice review needed' }, task('review and document result')]
      )
    );

    const machine = createMachine(p, {
      services: {
        'scan invoice': () => Promise.resolve(true),
        'archive original': () => Promise.resolve(true),
        'assign approver': () => Promise.resolve(true)
      }
    });

    const service = interpret(machine)
      .onDone(() => {
        done();
      })
      .start();

    setTimeout(() => {
      service.send('approver received');
    }, 100);
    setTimeout(() => {
      service.send('invoice review needed');
    }, 200);
  });
});
