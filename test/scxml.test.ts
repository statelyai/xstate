import { assert } from 'chai';
// import { Element as XMLElement } from 'xml-js';

import * as fs from 'fs';
import * as path from 'path';
// import * as util from 'util';

import { toMachine } from '../src/scxml';
import { StateNode } from '../src/StateNode';
import { interpret, SimulatedClock } from '../src/interpreter';
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
  'assign-current-small-step': ['test0', 'test1', 'test2', 'test3', 'test4'],
  basic: ['basic1', 'basic2'],
  'cond-js': ['test0', 'test1', 'test2', 'TestConditionalTransition'],
  data: [], // 4.0
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
  misc: ['deep-initial'],
  // 'more-parallel': [
  //   'test0',
  //   'test1',
  //   'test2',
  //   'test3',
  //   'test4',
  //   'test5',
  //   'test6',
  //   'test7',
  //   'test8',
  //   'test9',
  //   'test10'
  // ], // not well-formed tests
  parallel: ['test0', 'test1', 'test2', 'test3'],
  'targetless-transition': [
    'test0',
    'test1'
    // ,'test2', // TODO: parallel states with leaf node support
    // 'test3' // TODO: parallel states with leaf node support
  ],
  // 'parallel+interrupt': ['test0'],
  'w3c-ecma': ['test144.txml']
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
      // @ts-ignore
      // console.dir(state.historyValue, { depth: null });
      nextState = state;
    })
    .start(nextState);

  test.events.forEach(({ event, nextConfiguration, after }, i) => {
    if (after) {
      (service.clock as SimulatedClock).increment(after);
    }
    service.send(event.name);

    const stateIds = machine
      .getStateNodes(nextState)
      .map(stateNode => stateNode.id);

    assert.include(stateIds, nextConfiguration[0], `run ${i}`);
  });
}

function evalCond(expr: string, context: object | undefined) {
  const literalKeyExprs = context
    ? Object.keys(context)
        .map(key => `const ${key} = xs['${key}'];`)
        .join('\n')
    : '';

  const fn = new Function(
    `const xs = arguments[0]; ${literalKeyExprs} return ${expr}`
  ) as () => boolean;

  return fn;
}

describe('scxml', () => {
  const testGroupKeys = Object.keys(testGroups);
  // const testGroupKeys = ['w3c-ecma'];

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
          evalCond,
          delimiter: '$'
        });

        // console.dir(machine.config, { depth: null });
        await runTestToCompletion(machine, scxmlTest);
      });
    });
  });
});
