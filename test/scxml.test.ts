import * as fs from 'fs';
import * as path from 'path';
// import * as util from 'util';

import { toMachine } from '../src/scxml';
import { StateNode } from '../src/StateNode';
import { interpret } from '../src/interpreter';
import { SimulatedClock } from '../src/SimulatedClock';
import { State } from '../src';
import { pathsToStateValue } from '../src/utils';
// import { StateValue } from '../src/types';
// import { Event, StateValue, ActionObject } from '../src/types';
// import { actionTypes } from '../src/actions';

const testGroups = {
  actionSend: [
    'send1',
    'send2',
    'send3',
    'send4',
    'send7',
    'send8'
    // 'send9' // - edge case, since initial transitions in xstate are not microstepped
  ],
  assign: [
    // 'assign_invalid', // TODO: handle error.execution event
    'assign_obj_literal'
  ],
  'assign-current-small-step': ['test0', 'test1', 'test2', 'test3', 'test4'],
  basic: ['basic1', 'basic2'],
  'cond-js': ['test0', 'test1', 'test2', 'TestConditionalTransition'],
  data: [
    // 'data_invalid',
    'data_obj_literal'
  ],
  'default-initial-state': ['initial1', 'initial2'],
  delayedSend: ['send1', 'send2', 'send3'], // 4.0
  documentOrder: ['documentOrder0'],
  error: [], // not implemented
  forEach: [], // not implemented
  hierarchy: ['hier0', 'hier1', 'hier2'],
  'hierarchy+documentOrder': ['test0', 'test1'],
  history: [
    'history0',
    'history1',
    'history2',
    'history3',
    // 'history4', // TODO: support history nodes on parallel states
    'history5',
    'history6'
  ],
  'internal-transitions': ['test0', 'test1'],
  misc: ['deep-initial'],
  'more-parallel': [
    'test0',
    'test1',
    'test2',
    // 'test3',
    'test4',
    'test5',
    // 'test6',
    'test7',
    'test8',
    'test9'
    // 'test10'
  ],
  parallel: ['test0', 'test1', 'test2', 'test3'],
  'targetless-transition': ['test0', 'test1', 'test2', 'test3'],
  'parallel+interrupt': [
    'test0',
    // 'test1',
    'test2',
    'test3',
    'test4',
    // 'test5',
    'test6',
    // 'test7',
    'test8',
    'test9',
    'test10',
    'test11',
    // 'test12',
    'test13',
    'test14',
    // 'test15',
    'test16',
    'test17',
    'test18',
    'test19',
    // 'test20',
    // 'test21',
    'test22',
    'test23',
    'test24',
    // 'test25',
    // 'test26',
    'test27',
    'test28',
    'test29',
    'test30',
    'test31'
  ],
  // 'scxml-prefix-event-name-matching': ['star0'], TODO: source ordering of wildcard appearing first
  'w3c-ecma': [
    'test144.txml',
    'test158.txml',
    'test173.txml',
    'test174.txml',
    'test178.txml'
  ]
};

const overrides = {
  'assign-current-small-step': ['test0'],
  'targetless-transition': ['test0']
};

interface SCIONTest {
  initialConfiguration: string[];
  events: Array<{
    after?: number;
    event: { name: string };
    nextConfiguration: string[];
  }>;
}

async function runW3TestToCompletion(machine: StateNode): Promise<void> {
  await new Promise(res => {
    interpret(machine)
      .onDone(res)
      .start();
  });
}

async function runTestToCompletion(
  machine: StateNode,
  test: SCIONTest
): Promise<void> {
  if (!test.events.length && test.initialConfiguration[0] === 'pass') {
    await runW3TestToCompletion(machine);
    return;
  }
  const resolvedStateValue = machine.resolve(
    pathsToStateValue(
      test.initialConfiguration.map(id => machine.getStateNodeById(id).path)
    )
  );
  let nextState: State<any> = machine.getInitialState(resolvedStateValue);
  const service = interpret(machine, {
    clock: new SimulatedClock()
  })
    .onTransition(state => {
      nextState = state;
    })
    .start(nextState);

  test.events.forEach(({ event, nextConfiguration, after }) => {
    if (after) {
      (service.clock as SimulatedClock).increment(after);
    }
    service.send(event.name);

    const stateIds = machine
      .getStateNodes(nextState)
      .map(stateNode => stateNode.id);

    expect(stateIds).toContain(nextConfiguration[0]);
  });
}

describe('scxml', () => {
  const testGroupKeys = Object.keys(testGroups);
  // const testGroupKeys = ['scxml-prefix-event-name-matching'];

  testGroupKeys.forEach(testGroupName => {
    testGroups[testGroupName].forEach(testName => {
      const scxmlSource =
        overrides[testGroupName] &&
        overrides[testGroupName].indexOf(testName) !== -1
          ? `./fixtures/scxml/${testGroupName}/${testName}.scxml`
          : `../node_modules/scxml-test-framework/test/${testGroupName}/${testName}.scxml`;
      const scxmlDefinition = fs.readFileSync(
        path.resolve(__dirname, scxmlSource),
        { encoding: 'utf-8' }
      );
      const scxmlTest = JSON.parse(
        fs.readFileSync(
          path.resolve(
            __dirname,
            `../node_modules/scxml-test-framework/test/${testGroupName}/${testName}.json`
          ),
          { encoding: 'utf-8' }
        )
      ) as SCIONTest;

      it(`${testGroupName}/${testName}`, async () => {
        const machine = toMachine(scxmlDefinition, {
          delimiter: '$'
        });

        // console.dir(machine.config, { depth: null });
        await runTestToCompletion(machine, scxmlTest);
      });
    });
  });
});
