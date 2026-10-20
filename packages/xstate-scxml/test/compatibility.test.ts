import { createActor, createMachine } from 'xstate';
import { createMachineFromSCXML } from '../src/index.ts';

for (const mode of ['native', 'SCXML']) {
  describe(`${mode} compatibility contract`, () => {
    it('orders cross-region exit and entry effects according to its transition domain', () => {
      const trace: string[] = [];
      const machine =
        mode === 'native'
          ? createMachine({
              initial: 'active',
              states: {
                active: {
                  type: 'parallel',
                  entry: (_, enq) => enq(() => trace.push('active:entry')),
                  exit: (_, enq) => enq(() => trace.push('active:exit')),
                  states: {
                    left: {
                      initial: 'a',
                      entry: (_, enq) => enq(() => trace.push('left:entry')),
                      exit: (_, enq) => enq(() => trace.push('left:exit')),
                      states: {
                        a: {
                          entry: (_, enq) => enq(() => trace.push('a:entry')),
                          exit: (_, enq) => enq(() => trace.push('a:exit')),
                          on: { ADVANCE: { target: 'b' } }
                        },
                        b: {
                          entry: (_, enq) => enq(() => trace.push('b:entry')),
                          exit: (_, enq) => enq(() => trace.push('b:exit')),
                          on: {
                            CROSS: (_, enq) => {
                              enq(() => trace.push('cross'));
                              return { target: '#y' };
                            }
                          }
                        }
                      }
                    },
                    right: {
                      initial: 'x',
                      entry: (_, enq) => enq(() => trace.push('right:entry')),
                      exit: (_, enq) => enq(() => trace.push('right:exit')),
                      states: {
                        x: {
                          entry: (_, enq) => enq(() => trace.push('x:entry')),
                          exit: (_, enq) => enq(() => trace.push('x:exit'))
                        },
                        y: {
                          id: 'y',
                          entry: (_, enq) => enq(() => trace.push('y:entry'))
                        }
                      }
                    }
                  }
                }
              }
            })
          : createMachineFromSCXML(`
              <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" datamodel="ecmascript" initial="active">
                <parallel id="active">
                  <onentry><log expr="'active:entry'" /></onentry>
                  <onexit><log expr="'active:exit'" /></onexit>
                  <state id="left" initial="a">
                    <onentry><log expr="'left:entry'" /></onentry>
                    <onexit><log expr="'left:exit'" /></onexit>
                    <state id="a">
                      <onentry><log expr="'a:entry'" /></onentry>
                      <onexit><log expr="'a:exit'" /></onexit>
                      <transition event="ADVANCE" target="b" />
                    </state>
                    <state id="b">
                      <onentry><log expr="'b:entry'" /></onentry>
                      <onexit><log expr="'b:exit'" /></onexit>
                      <transition event="CROSS" target="y">
                        <log expr="'cross'" />
                      </transition>
                    </state>
                  </state>
                  <state id="right" initial="x">
                    <onentry><log expr="'right:entry'" /></onentry>
                    <onexit><log expr="'right:exit'" /></onexit>
                    <state id="x">
                      <onentry><log expr="'x:entry'" /></onentry>
                      <onexit><log expr="'x:exit'" /></onexit>
                    </state>
                    <state id="y">
                      <onentry><log expr="'y:entry'" /></onentry>
                    </state>
                  </state>
                </parallel>
              </scxml>
            `);
      const actor = createActor(machine, {
        logger: (value) => trace.push(value)
      }).start();
      expect(trace).toEqual([
        'active:entry',
        'left:entry',
        'a:entry',
        'right:entry',
        'x:entry'
      ]);
      actor.send({ type: 'ADVANCE' });
      expect(trace.slice(-2)).toEqual(['a:exit', 'b:entry']);
      trace.length = 0;

      actor.send({ type: 'CROSS' });

      expect(actor.getSnapshot().value).toEqual({
        active: { left: mode === 'native' ? 'b' : 'a', right: 'y' }
      });
      expect(trace).toEqual(
        mode === 'native'
          ? ['x:exit', 'cross', 'y:entry']
          : [
              'x:exit',
              'right:exit',
              'b:exit',
              'left:exit',
              'active:exit',
              'cross',
              'active:entry',
              'left:entry',
              'a:entry',
              'right:entry',
              'y:entry'
            ]
      );
      actor.stop();
    });

    it('restores deep parallel history and starts a fresh invoked actor after cleanup', () => {
      const trace: string[] = [];
      const worker = createMachine({
        entry: (_, enq) => enq(() => trace.push('worker:start'))
      });
      const machine =
        mode === 'native'
          ? createMachine({
              initial: 'active',
              states: {
                active: {
                  type: 'parallel',
                  entry: (_, enq) => enq(() => trace.push('active:entry')),
                  exit: (_, enq) => enq(() => trace.push('active:exit')),
                  on: { LEAVE: { target: 'off' } },
                  states: {
                    history: {
                      type: 'history',
                      history: 'deep',
                      target: ['left.a', 'right.x']
                    },
                    left: {
                      initial: 'a',
                      states: {
                        a: { on: { ADVANCE: { target: 'b' } } },
                        b: {
                          entry: (_, enq) => enq(() => trace.push('b:entry')),
                          exit: (_, enq) => enq(() => trace.push('b:exit')),
                          invoke: { id: 'worker', src: worker }
                        }
                      }
                    },
                    right: {
                      initial: 'x',
                      states: {
                        x: { on: { ADVANCE: { target: 'y' } } },
                        y: {
                          entry: (_, enq) => enq(() => trace.push('y:entry')),
                          exit: (_, enq) => enq(() => trace.push('y:exit'))
                        }
                      }
                    }
                  }
                },
                off: {
                  entry: (_, enq) => enq(() => trace.push('off:entry')),
                  on: { RESTORE: { target: 'active.history' } }
                }
              }
            })
          : createMachineFromSCXML(`
              <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" datamodel="ecmascript" initial="active">
                <parallel id="active">
                  <onentry><log expr="'active:entry'" /></onentry>
                  <onexit><log expr="'active:exit'" /></onexit>
                  <transition event="LEAVE" target="off" />
                  <history id="history" type="deep"><transition target="a x" /></history>
                  <state id="left" initial="a">
                    <state id="a"><transition event="ADVANCE" target="b" /></state>
                    <state id="b">
                      <onentry><log expr="'b:entry'" /></onentry>
                      <onexit><log expr="'b:exit'" /></onexit>
                      <invoke id="worker">
                        <content>
                          <scxml version="1.0" datamodel="ecmascript" initial="working">
                            <state id="working">
                              <onentry><log expr="'worker:start'" /></onentry>
                            </state>
                          </scxml>
                        </content>
                      </invoke>
                    </state>
                  </state>
                  <state id="right" initial="x">
                    <state id="x"><transition event="ADVANCE" target="y" /></state>
                    <state id="y">
                      <onentry><log expr="'y:entry'" /></onentry>
                      <onexit><log expr="'y:exit'" /></onexit>
                    </state>
                  </state>
                </parallel>
                <state id="off">
                  <onentry><log expr="'off:entry'" /></onentry>
                  <transition event="RESTORE" target="history" />
                </state>
              </scxml>
            `);
      const actor = createActor(machine, {
        logger: (value) => trace.push(value)
      }).start();
      actor.send({ type: 'ADVANCE' });
      expect(actor.getSnapshot().value).toEqual({
        active: { left: 'b', right: 'y' }
      });
      expect(trace).toEqual([
        'active:entry',
        'b:entry',
        'y:entry',
        'worker:start'
      ]);
      const firstWorker = actor.getSnapshot().children.worker;
      if (!firstWorker)
        throw new Error('Expected the first worker to be invoked');
      firstWorker.subscribe({ complete: () => trace.push('worker:stop') });
      trace.length = 0;

      actor.send({ type: 'LEAVE' });

      expect(actor.getSnapshot().value).toBe('off');
      expect(actor.getSnapshot().children.worker).toBeUndefined();
      expect(firstWorker.getSnapshot().status).toBe('stopped');
      expect(trace).toEqual([
        'y:exit',
        'b:exit',
        'worker:stop',
        'active:exit',
        'off:entry'
      ]);
      trace.length = 0;

      actor.send({ type: 'RESTORE' });

      expect(actor.getSnapshot().value).toEqual({
        active: { left: 'b', right: 'y' }
      });
      expect(trace).toEqual([
        'active:entry',
        'b:entry',
        'y:entry',
        'worker:start'
      ]);
      const restoredWorker = actor.getSnapshot().children.worker;
      if (!restoredWorker)
        throw new Error('Expected history to invoke a new worker');
      expect(restoredWorker).not.toBe(firstWorker);
      expect(restoredWorker.getSnapshot().status).toBe('active');
      restoredWorker.subscribe({ complete: () => trace.push('worker:stop') });
      trace.length = 0;
      actor.stop();
      expect(restoredWorker.getSnapshot().status).toBe('stopped');
      expect(trace).toEqual(['worker:stop']);
    });

    it('finishes eventless and internal transitions before processing the next external event', () => {
      const trace: string[] = [];
      const machine =
        mode === 'native'
          ? createMachine({
              initial: 'idle',
              states: {
                idle: {
                  on: {
                    GO: ({ self }, enq) => {
                      enq.raise({ type: 'INTERNAL' });
                      enq.sendTo(self, { type: 'EXTERNAL' });
                      enq(() => trace.push('go'));
                      return { target: 'transient' };
                    }
                  }
                },
                transient: {
                  entry: (_, enq) => enq(() => trace.push('transient:entry')),
                  always: (_, enq) => {
                    enq(() => trace.push('eventless'));
                    return { target: 'ready' };
                  }
                },
                ready: {
                  entry: (_, enq) => enq(() => trace.push('ready:entry')),
                  on: {
                    INTERNAL: (_, enq) => enq(() => trace.push('internal')),
                    EXTERNAL: (_, enq) => enq(() => trace.push('external'))
                  }
                }
              }
            })
          : createMachineFromSCXML(`
              <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" datamodel="ecmascript" initial="idle">
                <state id="idle">
                  <transition event="GO" target="transient">
                    <raise event="INTERNAL" />
                    <send event="EXTERNAL" />
                    <log expr="'go'" />
                  </transition>
                </state>
                <state id="transient">
                  <onentry><log expr="'transient:entry'" /></onentry>
                  <transition target="ready"><log expr="'eventless'" /></transition>
                </state>
                <state id="ready">
                  <onentry><log expr="'ready:entry'" /></onentry>
                  <transition event="INTERNAL"><log expr="'internal'" /></transition>
                  <transition event="EXTERNAL"><log expr="'external'" /></transition>
                </state>
              </scxml>
            `);
      const actor = createActor(machine, {
        logger: (value) => trace.push(value)
      }).start();

      actor.send({ type: 'GO' });

      expect(actor.getSnapshot().value).toBe('ready');
      expect(trace).toEqual([
        'go',
        'transient:entry',
        'eventless',
        'ready:entry',
        'internal',
        'external'
      ]);
      actor.stop();
    });
  });
}

it('allows an SCXML script to mutate a declared ECMAScript array', () => {
  const machine = createMachineFromSCXML(`
    <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0"
      datamodel="ecmascript" initial="idle">
      <datamodel><data id="items" expr="[]" /></datamodel>
      <state id="idle">
        <transition event="GO" target="done">
          <script>items.push('item')</script>
        </transition>
      </state>
      <state id="done">
        <transition event="error.execution" target="failed" />
      </state>
      <state id="failed" />
    </scxml>
  `);
  const actor = createActor(machine).start();

  actor.send({ type: 'GO' });

  expect(actor.getSnapshot().value).toBe('done');
  expect(actor.getSnapshot().context.items).toEqual(['item']);
  actor.stop();
});
