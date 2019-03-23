import { assert } from 'chai';
import { EventProcessor } from '../src/eventprocessor';

describe('event processor', () => {
    it('should process event only once', () => {
        let calledCount = 0;
        new EventProcessor().processEvent(() => {
            calledCount++;
        });

        const expectedCount = 1;
        assert.equal(calledCount, expectedCount);
    });

    it('should process more than one event', () => {
        let calledCount = 0;
        let handler = new EventProcessor();
        handler.processEvent(() => {
            calledCount++;
            handler.processEvent(() => {
                calledCount++;
            });
        });

        const expectedCount = 2;
        assert.equal(calledCount, expectedCount);
    });

    it('should process events in the same order they were hit', () => {
        let order : number[] = [];
        let handler = new EventProcessor();
        handler.processEvent(() => {
            order.push(1);
            handler.processEvent(() => {
                order.push(2);
            });
            handler.processEvent(() => {
                order.push(3);
                handler.processEvent(() => {
                    order.push(5);
                });
            });
            handler.processEvent(() => {
                order.push(4);
            });
        });

        const expectedOrder = [ 1, 2, 3, 4, 5 ];
        assert.equal(order.length, expectedOrder.length);
        for(let i = 0; i < expectedOrder.length; i++) {
            assert.equal(order[i], expectedOrder[i]);
        }
    });

    it('should recover if error is thrown while processing event', () => {
        let calledCount = 0;
        let handler = new EventProcessor();
        assert.throws(() => handler.processEvent(() => {
            calledCount++;
            throw Error("Test");
        }), "Test");
        handler.processEvent(() => {
            calledCount++;
        });

        const expectedCount = 2;
        assert.equal(calledCount, expectedCount);
    });

    it('should recover if error is thrown while processing the queue', () => {
        let calledCount = 0;
        let handler = new EventProcessor();
        assert.throws(() => handler.processEvent(() => {
            calledCount++;
            handler.processEvent(() => {
                calledCount++;
                throw Error("Test");
            });
        }), "Test");
        handler.processEvent(() => {
            calledCount++;
        });

        const expectedCount = 3;
        assert.equal(calledCount, expectedCount);
    });

    it('should stop processing events if error condition is met', () => {
        let calledCount = 0;
        let handler = new EventProcessor();
        assert.throws(() => handler.processEvent(() => {
            calledCount++;
            handler.processEvent(() => {
                calledCount++;
                throw Error('Test');
            });
            handler.processEvent(() => {
                calledCount++;
            });
        }), "Test");

        const expectedCount = 2;
        assert.equal(calledCount, expectedCount);
    });

    it('should discard not processed events in the case of error condition', () => {
        let calledCount = 0;
        let handler = new EventProcessor();
        assert.throws(() => handler.processEvent(() => {
            calledCount++;
            handler.processEvent(() => {
                calledCount++;
                throw Error('Test');
            });
            handler.processEvent(() => {
                calledCount++;
            });
        }), "Test");
        handler.processEvent(() => {
            calledCount++;
        });

        const expectedCount = 3;
        assert.equal(calledCount, expectedCount);
    });

    describe('deferred events', () => {
        it('should be able to defer events', () => {
            let calledCount = 0;
            const handler = new EventProcessor();
            handler.setDeferredStartup(true);
            handler.processEvent(() => {
                calledCount++;
            });

            const expectedCount = 0;
            assert.equal(calledCount, expectedCount);
            handler.Initialize(() => {});
            const expectedFinalCount = 1;
            assert.equal(calledCount, expectedFinalCount);
        });

        it('should process initialization before other events', () => {
            let callOrder: number[] = [];
            const handler = new EventProcessor();
            handler.setDeferredStartup(true);
            handler.processEvent(() => {
                callOrder.push(2);
            });
            handler.processEvent(() => {
                callOrder.push(3);
            });
            handler.Initialize(() => {
                callOrder.push(1);
            });

            const expectedOrder = [ 1, 2, 3 ];
            assert.equal(callOrder.length, expectedOrder.length);
            for(let i = 0; i < expectedOrder.length; i++) {
                assert.equal(callOrder[i], expectedOrder[i]);
            }
         });

        it('should not be able call event deferring twice', () => {
            const handler = new EventProcessor();
            handler.setDeferredStartup(true);

            assert.throws(() => handler.setDeferredStartup(true), Error,
                /Can only be called once during the lifetime of the EventProcessor/);
        });

        it('should not be able call event deferring after initialization call', () => {
            const handler = new EventProcessor();
            handler.Initialize(() => {});

            assert.throws(() => handler.setDeferredStartup(true), Error,
                /Events can be deferred only before .start\(\) method has not been called/);
        });

        it('should not defer events after initialization', () => {
            const handler = new EventProcessor();
            handler.setDeferredStartup(true);
            handler.Initialize(() => {});
            let calledCount = 0;
            handler.processEvent(() => {
                calledCount++;
            });

            const expectedCount = 1;
            assert.equal(calledCount, expectedCount);
        });
    });
});