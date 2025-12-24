import { describe, it, expect } from 'vitest';
import { toMachine, toMachineJSON } from '../src/scxml';
import { createMachineFromConfig } from '../src/createMachineFromConfig';
import { initialTransition, transition } from '../src/transition';
import { createMachine } from '../src';

describe('SCXML to XState conversion', () => {
  describe('toMachineJSON - basic state machine', () => {
    it('should convert a simple state machine with initial state', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="idle">
          <state id="idle">
            <transition event="START" target="running"/>
          </state>
          <state id="running">
            <transition event="STOP" target="idle"/>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.initial).toBe('idle');
      expect(json.states).toBeDefined();
      expect(Object.keys(json.states!)).toEqual(['idle', 'running']);
      expect(json.states!.idle.on).toBeDefined();
      expect(json.states!.running.on).toBeDefined();
    });

    it('should handle implicit initial state (first child)', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0">
          <state id="first"/>
          <state id="second"/>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.initial).toBe('first');
    });

    it('should handle final states', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="active">
          <state id="active">
            <transition event="FINISH" target="done"/>
          </state>
          <final id="done"/>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.states!.done.type).toBe('final');
    });
  });

  describe('toMachineJSON - nested states', () => {
    it('should convert nested compound states', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="parent">
          <state id="parent" initial="child1">
            <state id="child1">
              <transition event="NEXT" target="child2"/>
            </state>
            <state id="child2">
              <transition event="EXIT" target="outside"/>
            </state>
          </state>
          <state id="outside"/>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.states!.parent.initial).toBe('child1');
      expect(json.states!.parent.states).toBeDefined();
      expect(Object.keys(json.states!.parent.states!)).toEqual([
        'child1',
        'child2'
      ]);
    });
  });

  describe('toMachineJSON - parallel states', () => {
    it('should convert parallel states', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="parallel">
          <parallel id="parallel">
            <state id="region1" initial="a">
              <state id="a">
                <transition event="TO_B" target="b"/>
              </state>
              <state id="b"/>
            </state>
            <state id="region2" initial="x">
              <state id="x">
                <transition event="TO_Y" target="y"/>
              </state>
              <state id="y"/>
            </state>
          </parallel>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.states!.parallel.type).toBe('parallel');
      expect(json.states!.parallel.states!.region1).toBeDefined();
      expect(json.states!.parallel.states!.region2).toBeDefined();
    });
  });

  describe('toMachineJSON - datamodel (context)', () => {
    it('should convert datamodel to context', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="idle">
          <datamodel>
            <data id="count" expr="0"/>
            <data id="name" expr="'test'"/>
            <data id="items" expr="[1, 2, 3]"/>
          </datamodel>
          <state id="idle"/>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.context).toEqual({
        count: 0,
        name: 'test',
        items: [1, 2, 3]
      });
    });
  });

  describe('toMachineJSON - transitions', () => {
    it('should convert transitions with targets', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="a">
          <state id="a">
            <transition event="GO" target="b"/>
          </state>
          <state id="b"/>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      // SCXML events get .* suffix for prefix matching
      const transition = json.states!.a.on!['GO.*'];
      expect(transition).toBeDefined();
      expect((transition as any).target).toEqual(['b']);
    });

    it('should convert guarded transitions', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="idle">
          <state id="idle">
            <transition event="CHECK" cond="count > 3" target="high"/>
            <transition event="CHECK" target="low"/>
          </state>
          <state id="high"/>
          <state id="low"/>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      const transitions = json.states!.idle.on!['CHECK.*'];
      expect(Array.isArray(transitions)).toBe(true);
      expect((transitions as any[])[0].guard).toBeDefined();
      expect((transitions as any[])[0].guard.type).toBe('scxml.cond');
    });

    it('should convert In() guards', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="a">
          <state id="a">
            <transition event="GO" cond="In('b')" target="c"/>
          </state>
          <state id="b"/>
          <state id="c"/>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      const transition = json.states!.a.on!['GO.*'] as any;
      expect(transition.guard.type).toBe('xstate.stateIn');
      expect(transition.guard.params.stateId).toBe('#b');
    });
  });

  describe('toMachineJSON - actions', () => {
    it('should convert raise actions', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="a">
          <state id="a">
            <transition event="TRIGGER" target="b">
              <raise event="RAISED"/>
            </transition>
          </state>
          <state id="b"/>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      const transition = json.states!.a.on!['TRIGGER.*'] as any;
      expect(transition.actions).toBeDefined();
      expect(transition.actions[0].type).toBe('@xstate.raise');
      expect(transition.actions[0].event.type).toBe('RAISED');
    });

    it('should convert log actions', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="a">
          <state id="a">
            <onentry>
              <log expr="'entered state a'" label="info"/>
            </onentry>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.states!.a.entry).toBeDefined();
      expect(json.states!.a.entry![0].type).toBe('@xstate.log');
    });

    it('should convert cancel actions', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="a">
          <state id="a">
            <transition event="CANCEL">
              <cancel sendid="delayed1"/>
            </transition>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      const transition = json.states!.a.on!['CANCEL.*'] as any;
      expect(transition.actions[0].type).toBe('@xstate.cancel');
      expect(transition.actions[0].id).toBe('delayed1');
    });
  });

  describe('toMachineJSON - entry and exit actions', () => {
    it('should convert onentry actions', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="a">
          <state id="a">
            <onentry>
              <log expr="'entering a'"/>
            </onentry>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.states!.a.entry).toHaveLength(1);
      expect(json.states!.a.entry![0].type).toBe('@xstate.log');
    });

    it('should convert onexit actions', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="a">
          <state id="a">
            <onexit>
              <log expr="'exiting a'"/>
            </onexit>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.states!.a.exit).toHaveLength(1);
      expect(json.states!.a.exit![0].type).toBe('@xstate.log');
    });
  });

  describe('toMachineJSON - eventless transitions (always)', () => {
    it('should convert eventless transitions to always', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="a">
          <state id="a">
            <transition target="b"/>
          </state>
          <state id="b"/>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.states!.a.always).toBeDefined();
      const always = json.states!.a.always as any[];
      expect(always).toHaveLength(1);
      expect(always[0].target).toEqual(['b']);
    });
  });

  describe('toMachineJSON - internal vs external transitions', () => {
    it('should mark external transitions with reenter: true', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="parent">
          <state id="parent">
            <transition event="EXTERNAL" type="external" target="parent"/>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      const transition = json.states!.parent.on!['EXTERNAL.*'] as any;
      expect(transition.reenter).toBe(true);
    });

    it('should not mark internal transitions with reenter', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="parent">
          <state id="parent">
            <transition event="INTERNAL" type="internal"/>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      const transition = json.states!.parent.on!['INTERNAL.*'] as any;
      expect(transition.reenter).toBeFalsy();
    });
  });

  describe('toMachineJSON - send actions', () => {
    it('should convert send with target="#_internal" as raise', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="a">
          <state id="a">
            <transition event="TRIGGER">
              <send event="INTERNAL_EVENT" target="#_internal"/>
            </transition>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      const transition = json.states!.a.on!['TRIGGER.*'] as any;
      expect(transition.actions[0].type).toBe('@xstate.raise');
      expect(transition.actions[0].event.type).toBe('INTERNAL_EVENT');
    });

    it('should convert send with delay', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="a">
          <state id="a">
            <transition event="TRIGGER">
              <send event="DELAYED" delay="500ms"/>
            </transition>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      const transition = json.states!.a.on!['TRIGGER.*'] as any;
      expect(transition.actions[0].type).toBe('@xstate.raise');
      expect(transition.actions[0].delay).toBe(500);
    });
  });

  describe('toMachineJSON - multiple events per transition', () => {
    it('should handle multiple events on a single transition', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="idle">
          <state id="idle">
            <transition event="START RESUME" target="active"/>
          </state>
          <state id="active"/>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.states!.idle.on!['START.*']).toBeDefined();
      expect(json.states!.idle.on!['RESUME.*']).toBeDefined();
    });
  });

  describe('toMachineJSON - history states', () => {
    it('should convert shallow history states', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="parent">
          <state id="parent" initial="child1">
            <history id="hist" type="shallow">
              <transition target="child1"/>
            </history>
            <state id="child1"/>
            <state id="child2"/>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.states!.parent.states!.hist).toMatchObject({
        type: 'history',
        history: 'shallow',
        target: 'child1'
      });
    });

    it('should convert deep history states', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="parent">
          <state id="parent" initial="child1">
            <history id="deepHist" type="deep"/>
            <state id="child1"/>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.states!.parent.states!.deepHist).toMatchObject({
        type: 'history',
        history: 'deep'
      });
    });
  });

  describe('toMachineJSON - delay parsing', () => {
    it('should parse millisecond delays', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="a">
          <state id="a">
            <transition event="GO">
              <send event="DELAYED" delay="100ms"/>
            </transition>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      const transition = json.states!.a.on!['GO.*'] as any;
      expect(transition.actions[0].delay).toBe(100);
    });

    it('should parse second delays', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="a">
          <state id="a">
            <transition event="GO">
              <send event="DELAYED" delay="2s"/>
            </transition>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      const transition = json.states!.a.on!['GO.*'] as any;
      expect(transition.actions[0].delay).toBe(2000);
    });

    it('should parse decimal second delays', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="a">
          <state id="a">
            <transition event="GO">
              <send event="DELAYED" delay="1.5s"/>
            </transition>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      const transition = json.states!.a.on!['GO.*'] as any;
      expect(transition.actions[0].delay).toBe(1500);
    });
  });

  describe('toMachineJSON - state ID sanitization', () => {
    it('should sanitize state IDs with dots', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="state.one">
          <state id="state.one">
            <transition event="GO" target="state.two"/>
          </state>
          <state id="state.two"/>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      // Dots are replaced with $
      expect(json.initial).toBe('state$one');
      expect(json.states!['state$one']).toBeDefined();
      expect(json.states!['state$two']).toBeDefined();

      const transition = json.states!['state$one'].on!['GO.*'] as any;
      expect(transition.target).toEqual(['state$two']);
    });

    it('should sanitize nested state IDs with dots (foo.bar.baz → foo$bar$baz)', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="foo.bar">
          <state id="foo.bar" initial="baz.qux">
            <state id="baz.qux"/>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.initial).toBe('foo$bar');
      expect(json.states!['foo$bar'].id).toBe('foo$bar');
      expect(json.states!['foo$bar'].states!['baz$qux'].id).toBe('baz$qux');
    });
  });

  describe('toMachineJSON - state IDs', () => {
    it('should set id on root state', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" name="myMachine" initial="idle">
          <state id="idle"/>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.id).toBe('myMachine');
    });

    it('should set id on child states', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="a">
          <state id="a">
            <transition event="GO" target="b"/>
          </state>
          <state id="b"/>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.states!.a.id).toBe('a');
      expect(json.states!.b.id).toBe('b');
    });

    it('should set id on nested states (using direct id, not path)', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="parent">
          <state id="parent" initial="child">
            <state id="child"/>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.states!.parent.id).toBe('parent');
      expect(json.states!.parent.states!.child.id).toBe('child');
    });

    it('should set id on history states', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="parent">
          <state id="parent" initial="child1">
            <history id="hist"/>
            <state id="child1"/>
          </state>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.states!.parent.states!.hist.id).toBe('hist');
    });

    it('should set id on final states', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="active">
          <state id="active">
            <transition event="DONE" target="complete"/>
          </state>
          <final id="complete"/>
        </scxml>
      `;

      const json = toMachineJSON(scxml);

      expect(json.states!.complete.id).toBe('complete');
    });
  });

  describe('toMachine - creates machine from SCXML', () => {
    it('should create a machine with correct structure', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="idle">
          <state id="idle">
            <transition event="START" target="running"/>
          </state>
          <state id="running"/>
        </scxml>
      `;

      const machine = toMachine(scxml);

      expect(machine.root).toBeDefined();
      expect(machine.root.states.idle).toBeDefined();
      expect(machine.root.states.running).toBeDefined();
    });

    it('should create a machine with context from datamodel', () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="idle">
          <datamodel>
            <data id="count" expr="42"/>
          </datamodel>
          <state id="idle"/>
        </scxml>
      `;

      const machine = toMachine(scxml);

      expect(machine.config.context).toEqual({ count: 42 });
    });
  });
});

describe('createMachineFromConfig', () => {
  it('should create a machine from a JSON config', () => {
    const machine = createMachineFromConfig({
      context: { count: 42 },
      initial: 'a',
      states: {
        a: {
          entry: [{ type: '@xstate.assign', context: { count: 42 } }],
          on: {
            INC: {
              actions: [{ type: '@xstate.assign', context: { count: 43 } }]
            },
            DEC: {
              actions: [{ type: '@xstate.assign', context: { count: 41 } }]
            },
            NEXT: {
              actions: [{ type: '@xstate.assign', context: { count: 0 } }],
              target: 'b'
            },
            COND_NEXT: {
              guard: { type: 'customGuard' },
              target: 'c'
            }
          }
        },
        b: {
          on: {
            BACK: { target: 'a' }
          }
        },
        c: {}
      }
    }).provide({
      guards: {
        customGuard: () => true
      }
    });

    expect(machine.config.context).toEqual({ count: 42 });
    expect(machine.root.states.a).toBeDefined();
    expect(machine.root.states.b).toBeDefined();
    expect(machine.root.states.a.on!['INC']).toBeDefined();
    expect(machine.root.states.a.on!['DEC']).toBeDefined();
    expect(machine.root.states.a.on!['NEXT']).toBeDefined();

    const [initialState] = initialTransition(machine);
    expect(initialState.value).toEqual('a');
    expect(initialState.context).toEqual({ count: 42 });
    const [nextState] = transition(machine, initialState, { type: 'NEXT' });
    expect(nextState.value).toEqual('b');
    expect(nextState.context).toEqual({ count: 0 });
    const [nextState2] = transition(machine, nextState, { type: 'BACK' });
    expect(nextState2.value).toEqual('a');
    expect(nextState2.context).toEqual({ count: 42 });
    const [nextState3] = transition(machine, nextState2, { type: 'COND_NEXT' });
    expect(nextState3.value).toEqual('c');
    expect(nextState3.context).toEqual({ count: 42 });
  });

  it.only('test', () => {
    const scxml = `
<scxml 
    datamodel="ecmascript"
    xmlns="http://www.w3.org/2005/07/scxml"
    version="1.0">

    <datamodel>
        <data id="i"/>
    </datamodel>

    <state id="a">
        <transition target="b" event="t">
            <assign location="i" expr="0"/>
        </transition>
    </state>

    <state id="A">

        <state id="b">
            <transition target="c" cond="i &lt; 100">
                <assign location="i" expr="i + 1"/>
            </transition>
        </state>

        <state id="c">
            <transition target="b" cond="i &lt; 100">
                <assign location="i" expr="i + 1"/>
            </transition>
        </state>

        <transition target="d" cond="i === 100">
            <assign location="i" expr="i * 2"/>
        </transition>
    </state>


    <state id="d">
        <transition target="e" cond="i === 200"/>
        <transition target="f"/>
    </state>

    <state id="e"/>

    <state id="f"/>

</scxml>
    `;
    // const machine = toMachine(scxml);
    const machine = createMachineFromConfig({
      id: '(machine)',
      initial: 'a',
      states: {
        a: {
          id: 'a',
          on: {
            't.*': {
              target: ['#b'],
              actions: [
                {
                  type: 'scxml.assign',
                  location: 'i',
                  expr: '0'
                }
              ],
              reenter: true
            }
          }
        },
        A: {
          id: 'A',
          initial: 'b',
          states: {
            b: {
              id: 'b',
              always: [
                {
                  target: ['#c'],
                  actions: [
                    {
                      type: 'scxml.assign',
                      location: 'i',
                      expr: 'i + 1'
                    }
                  ],
                  guard: {
                    type: 'scxml.cond',
                    params: {
                      expr: 'i < 100'
                    }
                  },
                  reenter: true
                }
              ]
            },
            c: {
              id: 'c',
              always: [
                {
                  target: ['#b'],
                  actions: [
                    {
                      type: 'scxml.assign',
                      location: 'i',
                      expr: 'i + 1'
                    }
                  ],
                  guard: {
                    type: 'scxml.cond',
                    params: {
                      expr: 'i < 100'
                    }
                  },
                  reenter: true
                }
              ]
            }
          },
          always: [
            {
              target: ['#d'],
              actions: [
                {
                  type: 'scxml.assign',
                  location: 'i',
                  expr: 'i * 2'
                }
              ],
              guard: {
                type: 'scxml.cond',
                params: {
                  expr: 'i === 100'
                }
              },
              reenter: true
            }
          ]
        },
        d: {
          id: 'd',
          always: [
            {
              target: ['#e'],
              guard: {
                type: 'scxml.cond',
                params: {
                  expr: 'i === 200'
                }
              },
              reenter: true
            },
            {
              target: ['#f'],
              reenter: true
            }
          ]
        },
        e: {
          id: 'e'
        },
        f: {
          id: 'f'
        }
      },
      context: {
        i: undefined
      }
    });

    let [state] = initialTransition(machine);
    expect(state.value).toEqual('a');
    [state] = transition(machine, state, { type: 't' });
    expect(state.context).toEqual({ i: 100 });
    expect(state.value).toEqual('e');
  });
});
