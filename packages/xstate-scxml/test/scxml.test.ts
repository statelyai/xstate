import { Machine, StateMachine, State, interpret } from 'xstate';
import { xml2js } from 'xml-js';
import { transitionToSCXML, toSCXML } from '../src';
import { toMachine } from 'xstate/lib/scxml';
import { pathsToStateValue } from 'xstate/lib/utils';
import { SimulatedClock } from 'xstate/lib/SimulatedClock';
import * as fs from 'fs';

interface SCIONTest {
  initialConfiguration: string[];
  events: Array<{
    after?: number;
    event: { name: string };
    nextConfiguration: string[];
  }>;
}

async function runTestToCompletion(
  machine: StateMachine<any, any, any, any, any, any>,
  test: SCIONTest
): Promise<void> {
  const stateValue = test.events.length
    ? pathsToStateValue(
        test.initialConfiguration.map((id) => machine.getStateNodeById(id).path)
      )
    : machine.initialState.value;

  const resolvedStateValue = machine.resolve(stateValue);

  let done = false;
  let nextState: State<any> = machine.getInitialState(
    resolvedStateValue,
    machine.initialState.context
  );

  const service = interpret(machine, {
    clock: new SimulatedClock()
  })
    .onTransition((state) => {
      nextState = state;
    })
    .onDone(() => {
      done = true;
    })
    .start(nextState);

  // @ts-ignore
  // service._state = nextState;

  test.events.forEach(({ event, nextConfiguration, after }) => {
    if (done) {
      return;
    }
    if (after) {
      (service.clock as SimulatedClock).increment(after);
    }
    service.send(event.name);

    const stateIds = machine
      .getStateNodes(nextState)
      .map((stateNode) => stateNode.id);

    expect(stateIds).toContain(nextConfiguration[0]);
  });

  if (!test.events.length) {
    const stateIds = machine.getStateNodes(nextState).map((sn) => sn.id);
    expect(stateIds).toContain(test.initialConfiguration[0]);
  }
}

const testGroups = {
  actionSend: [
    'send1',
    'send2',
    'send3',
    'send4',
    'send4b',
    'send7',
    'send7b',
    'send8',
    'send8b',
    'send9'
  ]
  // assign: [
  // 'assign_obj_literal' // <script/> conversion not implemented
  // 'assign_invalid', // TODO: error handling for assign()
  // ],
  // 'assign-current-small-step': [
  // 'test0' // <script/> conversion not implemented
  // 'test1',
  // ]
};

describe('scxml', () => {
  const testGroupKeys = Object.keys(testGroups);
  // const testGroupKeys = ['scxml-prefix-event-name-matching'];

  testGroupKeys.forEach((testGroupName) => {
    testGroups[testGroupName].forEach((testName) => {
      const originalMachine = require(`./fixtures/${testGroupName}/${testName}`)
        .default;
      const scxmlDefinition = toSCXML(originalMachine);

      const scxmlTest = JSON.parse(
        fs.readFileSync(
          require.resolve(
            `@scion-scxml/test-framework/test/${testGroupName}/${testName}.json`
          ),
          {
            encoding: 'utf-8'
          }
        )
      ) as SCIONTest;

      it(`${testGroupName}/${testName} (sanity)`, async () => {
        await runTestToCompletion(originalMachine, scxmlTest);
      });

      it(`${testGroupName}/${testName}`, async () => {
        const machine = toMachine(scxmlDefinition, {
          delimiter: '$'
        });

        await runTestToCompletion(machine, scxmlTest);
      }, 2000);
    });
  });
});

// xdescribe('toSCXML', () => {
//   const testGroupKeys = Object.keys(testGroups);
//   // const testGroupKeys = ['scxml-prefix-event-name-matching'];

//   testGroupKeys.forEach(testGroupName => {
//     testGroups[testGroupName].forEach(testName => {
//       const scxmlSource = `@scion-scxml/test-framework/test/${testGroupName}/${testName}.scxml`;
//       const scxmlDefinition = fs.readFileSync(require.resolve(scxmlSource), {
//         encoding: 'utf-8'
//       });

//       const machine = require(`./fixtures/${testGroupName}/${testName}`)
//         .default;

//       it(`${testGroupName}/${testName}`, () => {
//         expect(xml2js(toSCXML(machine))).toEqual(
//           xml2js(scxmlDefinition, {
//             ignoreComment: true,
//             ignoreDeclaration: true
//           })
//         );
//       });
//     });
//   });
// });

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
