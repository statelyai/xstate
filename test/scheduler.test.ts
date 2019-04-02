import { assert } from 'chai';
import { Scheduler } from '../src/scheduler';

describe('scheduler', () => {
  it('should process event only once', () => {
    let calledCount = 0;
    const scheduler = new Scheduler();
    scheduler.initialize(); // TODO: refactor (use .start())
    scheduler.schedule(() => {
      calledCount++;
    });

    const expectedCount = 1;
    assert.equal(calledCount, expectedCount);
  });

  it('should process more than one event', () => {
    let calledCount = 0;
    const scheduler = new Scheduler();
    scheduler.initialize(); // TODO: refactor (use .start())
    scheduler.schedule(() => {
      calledCount++;
      scheduler.schedule(() => {
        calledCount++;
      });
    });

    const expectedCount = 2;
    assert.equal(calledCount, expectedCount);
  });

  it('should process events in the same order they were hit', () => {
    const order: number[] = [];
    const scheduler = new Scheduler();
    scheduler.initialize(); // TODO: refactor (use .start())
    scheduler.schedule(() => {
      order.push(1);
      scheduler.schedule(() => {
        order.push(2);
      });
      scheduler.schedule(() => {
        order.push(3);
        scheduler.schedule(() => {
          order.push(5);
        });
      });
      scheduler.schedule(() => {
        order.push(4);
      });
    });

    const expectedOrder = [1, 2, 3, 4, 5];
    assert.equal(order.length, expectedOrder.length);
    for (let i = 0; i < expectedOrder.length; i++) {
      assert.equal(order[i], expectedOrder[i]);
    }
  });

  it('should recover if error is thrown while processing event', () => {
    let calledCount = 0;
    const scheduler = new Scheduler();
    scheduler.initialize(); // TODO: refactor (use .start())
    assert.throws(
      () =>
        scheduler.schedule(() => {
          calledCount++;
          throw Error('Test');
        }),
      'Test'
    );
    scheduler.schedule(() => {
      calledCount++;
    });

    const expectedCount = 2;
    assert.equal(calledCount, expectedCount);
  });

  it('should recover if error is thrown while processing the queue', () => {
    let calledCount = 0;
    const scheduler = new Scheduler();
    scheduler.initialize(); // TODO: refactor (use .start())
    assert.throws(
      () =>
        scheduler.schedule(() => {
          calledCount++;
          scheduler.schedule(() => {
            calledCount++;
            throw Error('Test');
          });
        }),
      'Test'
    );
    scheduler.schedule(() => {
      calledCount++;
    });

    const expectedCount = 3;
    assert.equal(calledCount, expectedCount);
  });

  it('should stop processing events if error condition is met', () => {
    let calledCount = 0;
    const scheduler = new Scheduler();
    scheduler.initialize(); // TODO: refactor (use .start())
    assert.throws(
      () =>
        scheduler.schedule(() => {
          calledCount++;
          scheduler.schedule(() => {
            calledCount++;
            throw Error('Test');
          });
          scheduler.schedule(() => {
            calledCount++;
          });
        }),
      'Test'
    );

    const expectedCount = 2;
    assert.equal(calledCount, expectedCount);
  });

  it('should discard not processed events in the case of error condition', () => {
    let calledCount = 0;
    const scheduler = new Scheduler();
    scheduler.initialize(); // TODO: refactor (use .start())
    assert.throws(
      () =>
        scheduler.schedule(() => {
          calledCount++;
          scheduler.schedule(() => {
            calledCount++;
            throw Error('Test');
          });
          scheduler.schedule(() => {
            calledCount++;
          });
        }),
      'Test'
    );
    scheduler.schedule(() => {
      calledCount++;
    });

    const expectedCount = 3;
    assert.equal(calledCount, expectedCount);
  });

  describe('deferred events', () => {
    it('should be able to defer events', () => {
      let calledCount = 0;
      const scheduler = new Scheduler({
        deferEvents: true
      });
      scheduler.schedule(() => {
        calledCount++;
      });

      const expectedCount = 0;
      assert.equal(calledCount, expectedCount);
      scheduler.initialize(); // TODO: refactor (use .start())
      const expectedFinalCount = 1;
      assert.equal(calledCount, expectedFinalCount);
    });

    it('should process initialization before other events', () => {
      const callOrder: number[] = [];
      const scheduler = new Scheduler({
        deferEvents: true
      });
      scheduler.schedule(() => {
        callOrder.push(2);
      });
      scheduler.schedule(() => {
        callOrder.push(3);
      });
      scheduler.initialize(() => {
        callOrder.push(1);
      });

      const expectedOrder = [1, 2, 3];
      assert.equal(callOrder.length, expectedOrder.length);
      for (let i = 0; i < expectedOrder.length; i++) {
        assert.equal(callOrder[i], expectedOrder[i]);
      }
    });

    it('should not defer events after initialization', () => {
      const scheduler = new Scheduler({
        deferEvents: true
      });
      scheduler.initialize(); // TODO: refactor (use .start())
      let calledCount = 0;
      scheduler.schedule(() => {
        calledCount++;
      });

      const expectedCount = 1;
      assert.equal(calledCount, expectedCount);
    });
  });
});
