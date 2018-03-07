import { assert } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

import { toMachine } from '../src/scxml';
import { StateNode } from '../src/StateNode';
import { Machine, State } from '../src';
import { Event, StateValue, ActionObject } from '../src/types';
import { actionTypes } from '../src/actions';

const testGroups = {
  actionSend: ['send1', 'send2', 'send3', 'send4']
};

interface SCIONTest {
  initialConfiguration: string[];
  events: Array<{
    event: { name: string };
    nextConfiguration: string[];
  }>;
}

function runTestToCompletion(machine: StateNode, test: SCIONTest): void {
  let nextState: State | StateValue = test.initialConfiguration[0];
  const eventQueue: Event[] = [test.events[0].event.name];

  do {
    const event = eventQueue.shift();
    nextState = machine.transition(nextState, event!);
    console.log('>>', event, nextState.value);
    eventQueue.push(
      ...(nextState.actions as ActionObject[])
        .filter(action => action.type === actionTypes.raise)
        .map(action => action.event)
    );
  } while (eventQueue.length);

  assert.deepEqual(nextState.value, test.events[0].nextConfiguration[0]);
}

describe.only('scxml', () => {
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
        const machine = toMachine(scxmlDefinition);
        console.log(util.inspect(machine, false, 6));
        runTestToCompletion(Machine(machine), scxmlTest);
      });
    });
  });
});
