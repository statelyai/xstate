import { clearConsoleMocks } from '@xstate-repo/jest-utils';
import * as fs from 'fs';
import * as path from 'path';
import * as pkgUp from 'pkg-up';
import { SimulatedClock } from '../src/SimulatedClock';
import { AnyState, AnyStateMachine, createActor } from '../src/index.ts';
import { toMachine, sanitizeStateId } from '../src/scxml';
import { getStateNodes } from '../src/stateUtils';

const TEST_FRAMEWORK = path.dirname(
  pkgUp.sync({
    cwd: require.resolve('@scion-scxml/test-framework')
  }) as string
);

const testGroups: Record<string, string[]> = {
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
  ],
  assign: [
    // 'assign_invalid', // this has a syntax error on purpose, so it's not included
    // 'assign_obj_literal' // deep initial states are not supported
  ],
  'assign-current-small-step': ['test0', 'test1', 'test2', 'test3', 'test4'],
  basic: ['basic0', 'basic1', 'basic2'],
  'cond-js': ['test0', 'test1', 'test2', 'TestConditionalTransition'],
  data: [
    // 'data_invalid',
    // 'data_obj_literal' // deep initial states are not supported
  ],
  'default-initial-state': ['initial1', 'initial2'],
  delayedSend: ['send1', 'send2', 'send3'],
  documentOrder: ['documentOrder0'],
  error: [
    // 'error' // not implemented
  ],
  forEach: [
    // 'test1', // not implemented
  ],
  hierarchy: ['hier0', 'hier1', 'hier2'],
  'hierarchy+documentOrder': ['test0', 'test1'],
  history: [
    'history0',
    'history1',
    'history2',
    'history3',
    'history4',
    'history4b',
    'history5',
    'history6'
  ],
  'if-else': ['test0'],
  in: ['TestInPredicate'],
  'internal-transitions': ['test0', 'test1'],
  // misc: ['deep-initial'], // deep initial states are not supported
  'more-parallel': [
    'test0',
    'test1',
    'test2',
    'test2b',
    'test3',
    'test3b',
    'test4',
    'test5',
    'test6',
    'test6b',
    'test7',
    'test8',
    'test9',
    'test10',
    'test10b'
  ],
  'multiple-events-per-transition': ['test1'],
  parallel: ['test0', 'test1', 'test2', 'test3'],
  'parallel+interrupt': [
    'test0',
    'test1',
    'test2',
    'test3',
    'test4',
    'test5',
    'test6',
    'test7',
    'test7b',
    'test8',
    'test9',
    'test10',
    'test11',
    'test12',
    'test13',
    'test14',
    'test15',
    'test16',
    'test17',
    'test18',
    'test19',
    'test20',
    'test21',
    'test21b',
    'test21c',
    'test22',
    'test23',
    'test24',
    'test25',
    'test27',
    'test28',
    'test29',
    'test30',
    'test31'
  ],
  // script: ['test0', 'test1', 'test2'], // <script/> conversion not implemented
  // 'script-src': ['test0', 'test1', 'test2', 'test3'], // <script/> conversion not implemented
  'scxml-prefix-event-name-matching': [
    // 'star0' // this relies on the source order of transitions where * is first and it's supposed to get macthed over an explicit descriptor
    // prefix event matching not implemented yet
    // 'test0',
    // 'test1'
  ],
  // 'send-data': ['send1'], // <content> conversion not implemented
  // 'send-idlocation': ['test0'],
  // 'send-internal': ['test0'],
  'targetless-transition': ['test0', 'test1', 'test2', 'test3'],
  'w3c-ecma': [
    'test144.txml',
    'test147.txml',
    'test148.txml',
    'test149.txml',
    // 'test150.txml', // <foreach> not implemented yet
    // 'test151.txml', // <foreach> not implemented yet
    // 'test152.txml', // <foreach> not implemented yet
    // 'test153.txml', // <foreach> not implemented yet
    // 'test155.txml', // <foreach> not implemented yet
    // 'test156.txml', // <foreach> not implemented yet
    'test158.txml',
    // 'test159.txml', // different error handling
    'test172.txml',
    'test173.txml',
    'test174.txml',
    'test175.txml',
    'test176.txml',
    // 'test179.txml', // conversion of <content> in <send> not implemented yet
    // 'test183.txml', // idlocation not implemented yet
    'test185.txml',
    'test186.txml',
    'test187.txml',
    'test189.txml',
    'test190.txml', // note: _sessionid is undefined for expressions
    'test191.txml',
    'test192.txml',
    'test193.txml',
    // 'test194.txml', // it's using an invalid event target (another actor), we should be erroring on this somehow when we revamp the error story
    // 'test198.txml', // origintype not implemented yet
    // 'test199.txml', // send type not checked
    'test200.txml',
    'test201.txml',
    'test205.txml',
    // 'test207.txml', // delayexpr
    'test208.txml',
    // 'test210.txml', // sendidexpr not supported yet
    // 'test215.txml', // <invoke typeexpr="...">
    // 'test216.txml', // <invoke srcexpr="...">
    'test220.txml',
    // 'test223.txml', // idlocation not implemented yet
    // 'test224.txml', // <invoke idlocation="...">
    // 'test225.txml', // unique invokeids generated at invoke time
    // 'test226.txml', // <invoke src="...">
    // 'test228.txml', // this test relies on `invokeid` being available on the event
    // 'test229.txml', // autoForward not supported in v5
    // 'test230.txml', // autoForward not supported in v5
    'test232.txml',
    // 'test233.txml', // <finalize> not implemented yet
    // 'test234.txml', // <finalize> not implemented yet
    'test235.txml',
    // 'test236.txml', // reaching a final state should execute all onexit handlers
    'test237.txml',
    // 'test239.txml', // <invoke src="...">
    // 'test240.txml', // conversion of namelist not implemented yet
    // 'test241.txml', // conversion of namelist not implemented yet
    // 'test242.txml', // <invoke src="...">
    // 'test243.txml', // conversion of <param> in <scxml> not implemented yet
    // 'test244.txml', // conversion of namelist not implemented yet
    // 'test245.txml', // conversion of namelist not implemented yet
    'test247.txml',
    // 'test250.txml', // this is a manual test - we could test it by snapshoting logged valued
    // 'test252.txml', // this expects the parent to not receive the event sent from the canceled child's exit action
    // 'test253.txml', // _event.origintype not implemented yet
    // 'test276.txml', // <invoke src="...">
    // 'test277.txml', // illegal expression in datamodel creates unbound variable
    // 'test278.txml', // non-root datamodel with early binding not implemented yet
    // 'test279.txml', // non-root datamodel with early binding not implemented yet
    // 'test280.txml', // non-root datamodel with late binding not implemented yet
    // 'test286.txml', // this intentionally throws when executing assign, we should be erroring on this somehow when we revamp the error story
    'test287.txml',
    // 'test294.txml', // conversion of <donedata> not implemented yet
    // 'test298.txml', // error.execution when evaluating donedata
    // 'test302.txml', // conversion of <script> not implemented yet
    // 'test303-1.txml', // conversion of <script> not implemented yet
    // 'test303-2.txml', // conversion of <script> not implemented yet
    // 'test303.txml', // conversion of <script> not implemented yet
    // 'test304.txml', // conversion of <script> not implemented yet
    // 'test307.txml', // non-root datamodel with late binding not implemented yet
    // 'test309.txml', // error in cond expression being treated as false
    // 'test310.txml', // conversion of In() predicate not implemented yet
    // 'test311.txml', // error.execution when evaluating assign
    // 'test312.txml', // error.execution when evaluating assign
    // 'test313.txml', // error.execution when evaluating assign
    // 'test314.txml', // error.execution when evaluating assign
    'test318.txml',
    // 'test319.txml', // SCXML has no init event, so _event stays unbound in onentry of initial state
    // 'test321.txml', // _sessionid not yet available for expressions
    // 'test322.txml', // _sessionid not yet available for expressions
    // 'test323.txml', // _name not yet available for expressions
    // 'test324.txml', // _name not yet available for expressions
    // 'test325.txml', // _ioprocessors not yet available for expressions
    // 'test326.txml', // _ioprocessors not yet available for expressions
    // 'test329.txml', // system variables can't be modified, we don't keep them in datamodel, so it might be hard to run this test
    // 'test330.txml', // SCXML _event properties not implemented yet
    // 'test331.txml', // _event.type not implemented yet correctly
    // 'test332.txml', // idlocation not implemented yet
    'test333.txml',
    'test335.txml',
    'test336.txml',
    'test337.txml',
    // 'test338.txml', // <invoke idlocation="..."> + _event.invokeid available on <send> events received from the invoked child
    'test339.txml',
    'test342.txml',
    // 'test343.txml', // error.execution when evaluating donedata
    // 'test344.txml', // error in cond expression being treated as false and raises error.execution
    // 'test346.txml', // system variables can't be modified, we don't keep them in datamodel, so it might be hard to run this test
    'test347.txml',
    'test348.txml',
    'test349.txml',
    // 'test350.txml', // _sessionid not yet available for expressions
    // 'test351.txml', // _event.sendid not implemented yet
    // 'test352.txml', // _event.origintype not implemented yet
    // 'test354.txml', // conversion of namelist not implemented yet
    'test355.txml',
    // 'test364.txml', // deep initial states are not supported
    'test372.txml',
    'test375.txml',
    // 'test376.txml', // executable blocks not implemented
    'test377.txml',
    // 'test378.txml', // executable blocks not implemented
    'test387.txml',
    // 'test388.txml', // deep initial states are not supported
    'test396.txml',
    'test399.txml',
    // 'test401.txml', // this assign to "non-existent" location in the datamodel, this is not exactly allowed in SCXML, but we don't disallow it - since u can assign to just any property on the `context` itself
    // 'test402.txml', // TODO: investigate more, it expects error.execution when evaluating assign, check if assigning to a deep location is even allowed, check if assigning to an initialized datamodel is allowed, improve how datamodel is exposed to constructed functions
    'test403a.txml',
    'test403b.txml',
    'test403c.txml',
    'test404.txml',
    'test405.txml',
    'test406.txml',
    'test407.txml',
    // 'test409.txml', // conversion of In() predicate not implemented yet
    // 'test411.txml', // conversion of In() predicate not implemented yet + microstep not implemented correctly
    // 'test412.txml', // initial transitions with executable content not implemented yet
    // 'test413.txml', // conversion of In() predicate not implemented yet
    'test416.txml',
    'test417.txml',
    'test419.txml',
    'test421.txml',
    // 'test422.txml', conversion of type-less <invoke> not implemented yet
    'test423.txml',
    // 'test436.txml', // conversion of In() predicate not implemented yet + null datamodel not implemented yet
    // 'test444.txml', // datamodel being mutated in cond's expression 😱
    'test445.txml',
    // 'test446.txml', // conversion of <data src="..."> not implemented yet
    // 'test448.txml', // nested datamodels not implemented yet
    'test449.txml',
    // 'test451.txml', // conversion of In() predicate not implemented yet
    // 'test452.txml', // conversion of <script> not implemented yet
    'test453.txml',
    // 'test456.txml', // conversion of <script> not implemented yet
    // 'test457.txml', // <foreach> not implemented yet
    // 'test459.txml', // <foreach> not implemented yet
    // 'test460.txml', // <foreach> not implemented yet
    // 'test487.txml', // this has a syntax error on purpose, so it's not included
    // 'test488.txml', // error.execution when evaluating param
    'test495.txml',
    // 'test496.txml', // error.communication not implemented yet
    // 'test500.txml', // _ioprocessors not yet available for expressions
    // 'test501.txml', // _ioprocessors not yet available for expressions
    'test503.txml',
    'test504.txml',
    'test505.txml',
    // 'test506.txml', // `reenter` semantics in v5 are different from SCXML type="internal"/"external" transitions, we respect `reenter` on all state types, not just on compound states
    // 'test509.txml', // Basic HTTP Event I/O processor not implemented
    // 'test510.txml', // Basic HTTP Event I/O processor not implemented
    // 'test518.txml', // Basic HTTP Event I/O processor not implemented
    // 'test519.txml', // Basic HTTP Event I/O processor not implemented
    // 'test520.txml', // Basic HTTP Event I/O processor not implemented
    // 'test521.txml', // error.communication not implemented yet
    // 'test522.txml', // Basic HTTP Event I/O processor not implemented
    // 'test525.txml', // <foreach> not implemented yet
    // 'test527.txml', // conversion of <donedata> not implemented yet
    // 'test528.txml', // conversion of <donedata> not implemented yet + error.execution when evaluating donedata
    // 'test529.txml', // conversion of <donedata> not implemented yet
    // 'test530.txml', // https://github.com/davidkpiano/xstate/pull/1811#discussion_r551897693
    // 'test531.txml', // Basic HTTP Event I/O processor not implemented
    // 'test532.txml', // Basic HTTP Event I/O processor not implemented
    // 'test533.txml', // we allow `reenter: false` to not leave the source state even if that source state is not compound
    // 'test534.txml', // Basic HTTP Event I/O processor not implemented
    // 'test550.txml', // non-root datamodel with early binding not implemented yet
    // 'test551.txml', // non-root datamodel with early binding not implemented yet
    // 'test552.txml', // conversion of <data src="..."> not implemented yet
    // 'test553.txml', // namelist not implemented yet + errored send not dispatching an event
    // 'test554.txml', // namelist not implemented yet + errored invoke cancelled
    // 'test557.txml', // conversion of <data src="..."> not implemented yet
    // 'test558.txml', // conversion of <data src="..."> not implemented yet
    'test560.txml',
    // 'test561.txml', // processor creates an ECMAScript DOM object _event.data when receiving XML in an event
    // 'test562.txml', // test that processor creates space normalized string in _event.data when receiving anything other than KVPs or XML in an event
    // 'test567.txml', // Basic HTTP Event I/O processor not implemented
    // 'test569.txml', // _ioprocessors not yet available for expressions
    'test570.txml'
    // 'test576.txml' // multiple initial states are not supported
    // 'test577.txml', // Basic HTTP Event I/O processor not implemented
    // 'test578.txml', // conversion of <content> in <send> not implemented yet
    // 'test579.txml' // executable content in history states not implemented yet
    // 'test580.txml' // conversion of In() predicate not implemented yet
  ]
};

const overrides: Record<string, string[]> = {
  'assign-current-small-step': [
    // original using <script/> to manipulate datamodel
    'test0'
  ]
};

interface SCIONTest {
  initialConfiguration: string[];
  events: Array<{
    after?: number;
    event: { name: string };
    nextConfiguration: string[];
  }>;
}

async function runW3TestToCompletion(machine: AnyStateMachine): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let nextState: AnyState;
    let prevState: AnyState;

    const actor = createActor(machine, {
      logger: () => void 0
    });
    actor.subscribe({
      next: (state) => {
        prevState = nextState;
        nextState = state;
      },
      complete: () => {
        // Add 'final' for test230.txml which does not have a 'pass' state
        if (['final', 'pass'].includes(nextState.value as string)) {
          resolve();
        } else {
          reject(
            new Error(
              `Reached "fail" state from state ${JSON.stringify(
                prevState?.value
              )}`
            )
          );
        }
      }
    });
    actor.start();
  });
}

async function runTestToCompletion(
  machine: AnyStateMachine,
  test: SCIONTest
): Promise<void> {
  if (!test.events.length && test.initialConfiguration[0] === 'pass') {
    await runW3TestToCompletion(machine);
    return;
  }

  let done = false;
  const service = createActor(machine, {
    clock: new SimulatedClock()
  });

  let nextState: AnyState = service.getSnapshot();
  let prevState: AnyState;
  service.subscribe((state) => {
    prevState = nextState;
    nextState = state;
  });
  service.subscribe({
    complete: () => {
      if (nextState.value === 'fail') {
        throw new Error(
          `Reached "fail" state from state ${JSON.stringify(prevState?.value)}`
        );
      }
      done = true;
    }
  });
  service.start();

  test.events.forEach(({ event, nextConfiguration, after }) => {
    if (done) {
      return;
    }
    if (after) {
      (service.clock as SimulatedClock).increment(after);
    }
    service.send({ type: event.name });

    const stateIds = getStateNodes(machine.root, nextState).map(
      (stateNode) => stateNode.id
    );

    expect(stateIds).toContain(sanitizeStateId(nextConfiguration[0]));
  });
}

describe('scxml', () => {
  const onlyTests: string[] = [
    // e.g., 'test399.txml'
    // 'test175.txml'
  ];
  const testGroupKeys = Object.keys(testGroups);

  testGroupKeys.forEach((testGroupName) => {
    const testNames = testGroups[testGroupName];

    testNames.forEach((testName) => {
      const execTest = onlyTests.length
        ? onlyTests.includes(testName)
          ? it.only
          : it.skip
        : it;

      const scxmlSource =
        overrides[testGroupName] &&
        overrides[testGroupName].indexOf(testName) !== -1
          ? `./fixtures/scxml/${testGroupName}/${testName}.scxml`
          : `${TEST_FRAMEWORK}/test/${testGroupName}/${testName}.scxml`;
      const scxmlDefinition = fs.readFileSync(
        path.resolve(__dirname, scxmlSource),
        { encoding: 'utf-8' }
      );
      const scxmlTest = JSON.parse(
        fs.readFileSync(
          path.resolve(
            __dirname,
            `${TEST_FRAMEWORK}/test/${testGroupName}/${testName}.json`
          ),
          { encoding: 'utf-8' }
        )
      ) as SCIONTest;

      execTest(`${testGroupName}/${testName}`, async () => {
        const machine = toMachine(scxmlDefinition);

        try {
          await runTestToCompletion(machine, scxmlTest);
        } catch (e) {
          console.log(JSON.stringify(machine.config, null, 2));
          throw e;
        } finally {
          clearConsoleMocks();
        }
      });
    });
  });
});
