import { Machine } from 'xstate';
import { xml2js } from 'xml-js';
import { transitionToSCXML } from '../src';

const pedestrianStates = {
  initial: 'walk',
  states: {
    walk: {
      on: {
        PED_COUNTDOWN: {
          target: 'wait',
          internal: true
        },
        TIMER: undefined // forbidden event
      }
    },
    wait: {
      on: {
        PED_COUNTDOWN: 'stop',
        TIMER: undefined // forbidden event
      }
    },
    stop: {
      type: 'final' as const,
      data: {
        foo: 'bar'
      }
    }
  }
};

const lightMachine = Machine({
  key: 'light',
  initial: 'green',
  states: {
    green: {
      entry: 'enterGreen',
      exit: 'exitGreen',
      on: {
        TIMER: 'yellow',
        POWER_OUTAGE: 'red'
      }
    },
    yellow: {
      on: {
        TIMER: 'red',
        POWER_OUTAGE: 'red'
      },
      after: {
        1000: 'red'
      },
      type: 'parallel',
      states: {
        one: {
          initial: 'inactive',
          states: {
            inactive: {},
            active: {}
          }
        },
        two: {
          initial: 'inactive',
          states: {
            inactive: {},
            active: {}
          }
        }
      }
    },
    red: {
      on: {
        TIMER: 'green',
        POWER_OUTAGE: {
          target: 'red',
          internal: true
        }
      },
      ...pedestrianStates
    }
  }
});

xdescribe('transition to SCXML', () => {
  it('converts a simple transition', () => {
    const transition = lightMachine.states.green.on.TIMER;

    const scxml = transitionToSCXML(transition[0]);

    expect(scxml).toEqual(
      xml2js(`<transition event="TIMER" target="light.yellow" />`).elements[0]
    );
  });

  it('converts a full transition', () => {
    const machine = Machine({
      initial: 'test',
      states: {
        test: {
          id: 'test',
          on: {
            SOME_EVENT: {
              target: 'next',
              internal: true,
              cond: () => true,
              in: '#test',
              actions: ['foo', 'bar']
            }
          }
        },
        next: {
          id: 'next'
        }
      }
    });

    const scxml = transitionToSCXML(machine.states.test.on.SOME_EVENT[0]);

    expect(scxml).toEqual(
      xml2js(
        `<transition event="SOME_EVENT" target="next" type="internal" cond="${
          scxml.attributes!.cond
        }" />`
      ).elements[0]
    );
  });
});
