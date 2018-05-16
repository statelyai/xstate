import { assert } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
// import * as util from 'util';

import { toMachine } from '../src/scxml';
import { StateNode } from '../src/StateNode';
import { Machine, State } from '../src';
import { pathsToStateValue } from '../src/utils';
import { StateValue } from '../src/types';
// import { Event, StateValue, ActionObject } from '../src/types';
// import { actionTypes } from '../src/actions';

const testGroups = {
  actionSend: [
    'send1',
    'send2',
    'send3',
    'send4',
    'send7',
    'send8' /* 'send9' */
  ],
  basic: ['basic1', 'basic2'],
  'cond-js': ['test0', 'test1', 'test2', 'TestConditionalTransition'],
  'default-initial-state': ['initial1', 'initial2'],
  documentOrder: ['documentOrder0'],
  hierarchy: ['hier0', 'hier1', 'hier2'],
  'hierarchy+documentOrder': ['test0', 'test1'],
  misc: ['deep-initial'],
  parallel: [
    'test0',
    'test1'

    // TODO: add support for parallel states with leaf nodes,
    // e.g.: { foo: { bar: undefined, baz: undefined } }
    // 'test2',
    // 'test3'
  ]
};

interface SCIONTest {
  initialConfiguration: string[];
  events: Array<{
    event: { name: string };
    nextConfiguration: string[];
  }>;
}

function runTestToCompletion(machine: StateNode, test: SCIONTest): void {
  // let nextState: string | State = `#${test.initialConfiguration[0]}`;
  let nextState: StateValue | State = pathsToStateValue(
    test.initialConfiguration.map(id => machine.getStateNodeById(id).path)
  );

  for (const { event, nextConfiguration } of test.events) {
    nextState = machine.transition(nextState, event.name);

    const stateIds = machine
      .getStateNodes(nextState)
      .map(stateNode => stateNode.id);

    assert.include(stateIds, nextConfiguration[0]);
  }
}

function evalCond(expr: string) {
  return new Function(`return ${expr}`) as () => boolean;
}

describe('scxml', () => {
  Object.keys(testGroups).forEach(testGroupName => {
    testGroups[testGroupName].forEach(testName => {
      const scxmlDefinition = fs.readFileSync(
        path.resolve(
          __dirname,
          `../node_modules/scxml-test-framework/test/${testGroupName}/${testName}.scxml`
        ),
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

      it(`${testGroupName}/${testName}`, () => {
        const machine = toMachine(scxmlDefinition, {
          evalCond,
          delimiter: '$'
        });
        // console.log(util.inspect(machine, false, 10));
        runTestToCompletion(Machine(machine), scxmlTest);
      });
    });
  });
});
