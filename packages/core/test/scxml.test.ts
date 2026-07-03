import * as fs from 'fs';
import * as path from 'path';
import * as pkgUp from 'pkg-up';
import { SimulatedClock } from '../src/SimulatedClock';
import {
  AnyMachineSnapshot,
  AnyStateMachine,
  createActor
} from '../src/index.ts';
import { toMachine, sanitizeStateId, toMachineJSON } from '../src/scxml';
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
    // 'assign_obj_literal' // passes with runW3TestToCompletion but not SimulatedClock harness
  ],
  'assign-current-small-step': ['test0', 'test1', 'test2', 'test3', 'test4'],
  basic: ['basic0', 'basic1', 'basic2'],
  'cond-js': ['test0', 'test1', 'test2', 'TestConditionalTransition'],
  data: [
    // 'data_invalid',
    // 'data_obj_literal' // requires deep initial state (`initial="s1"` references descendant)
  ],
  'default-initial-state': ['initial1', 'initial2'],
  delayedSend: ['send1', 'send2', 'send3'],
  documentOrder: ['documentOrder0'],
  // error: ['error'], // auto-completes; fails with SimulatedClock harness
  foreach: ['test1'],
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
  // misc: ['deep-initial'], // deep initial states not supported; throws uncaught exception
  'more-parallel': [
    'test0',
    'test1',
    'test2',
    'test2b',
    'test3',
    // 'test3b', // a reentering transition contained in one parallel region reenters only that region, so it doesn't conflict with (and get preempted by) sibling-region transitions as strict SCXML external-transition domains would require
    'test4',
    'test5',
    'test6',
    // 'test6b', // same deviation as test3b
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
  script: ['test0', 'test1', 'test2'],
  // 'script-src': ['test0', 'test1', 'test2', 'test3'], // <script src="..."/> conversion not implemented
  'scxml-prefix-event-name-matching': [
    // 'star0', // auto-completes; fails with SimulatedClock harness
    'test0',
    'test1'
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
    'test150.txml',
    'test151.txml',
    'test152.txml',
    'test153.txml',
    'test155.txml',
    'test156.txml',
    'test158.txml',
    'test159.txml',
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
    'test194.txml',
    'test198.txml',
    // 'test199.txml', // send type not checked
    'test200.txml',
    // 'test201.txml', // requires basic HTTP I/O processor
    'test205.txml',
    'test207.txml',
    'test208.txml',
    'test210.txml',
    // 'test215.txml', // <invoke typeexpr="...">
    // 'test216.txml', // <invoke srcexpr="...">
    'test220.txml',
    // 'test223.txml', // <invoke idlocation="..."> not implemented
    // 'test224.txml', // <invoke idlocation="..."> not implemented
    // 'test225.txml', // requires unique invokeids generated per invoke
    // 'test226.txml', // <invoke src="..."> with external file
    // 'test228.txml', // requires _event.invokeid propagation on done.invoke
    // 'test229.txml', // <invoke autoforward="true"> not implemented
    // 'test230.txml', // <invoke autoforward="true"> not implemented
    'test232.txml',
    // 'test233.txml', // <finalize> not implemented
    // 'test234.txml', // <finalize> not implemented
    'test235.txml',
    'test236.txml',
    'test237.txml',
    // 'test239.txml', // <invoke src="..."> with external file
    // 'test240.txml', // <invoke namelist="..."> not implemented
    'test241.txml',
    // 'test242.txml', // <invoke src="..."> with external file
    // 'test243.txml', // <param> in <scxml> not implemented
    // 'test244.txml', // <invoke namelist="..."> not implemented
    'test245.txml',
    'test247.txml',
    // 'test250.txml', // manual test; invoke child leaks uncaught exception
    // 'test252.txml', // cancelled child; invoke child leaks uncaught exception
    // 'test253.txml', // requires invoke + child→parent origintype propagation
    // 'test276.txml', // <invoke src="..."> with external file
    // 'test277.txml', // illegal expression in datamodel creates unbound variable
    // 'test278.txml', // non-root datamodel with early binding not implemented yet
    // 'test279.txml', // non-root datamodel with early binding not implemented yet
    // 'test280.txml', // non-root datamodel with late binding not implemented yet
    'test286.txml',
    'test287.txml',
    'test294.txml',
    // 'test298.txml', // TODO: evaluate <donedata> before done.state so error.execution wins
    // 'test302.txml', // <script> with src attribute not supported
    // 'test303-1.txml', // <script> src timing
    // 'test303-2.txml', // <script> src timing
    // 'test303.txml', // <script> src timing
    // 'test304.txml', // <script> at top level
    'test307.txml',
    'test309.txml',
    'test310.txml',
    'test311.txml',
    'test312.txml',
    'test313.txml',
    'test314.txml',
    'test318.txml',
    'test319.txml',
    'test321.txml',
    // 'test322.txml', // _sessionid immutability not enforced
    'test323.txml',
    // 'test324.txml', // _name immutability not enforced
    // 'test325.txml', // _ioprocessors location comparison
    // 'test326.txml', // _ioprocessors immutability
    // 'test329.txml', // system variables can't be modified
    'test330.txml',
    'test331.txml',
    // 'test332.txml', // idlocation not implemented
    'test333.txml',
    'test335.txml',
    'test336.txml',
    'test337.txml',
    'test338.txml',
    'test339.txml',
    'test342.txml',
    // 'test343.txml', // TODO: evaluate <donedata> before done.state so error.execution wins
    'test344.txml',
    // 'test346.txml', // system variables can't be modified, we don't keep them in datamodel, so it might be hard to run this test
    'test347.txml',
    'test348.txml',
    'test349.txml',
    'test350.txml',
    'test351.txml',
    'test352.txml',
    // 'test354.txml', // namelist in send not fully supported
    'test355.txml',
    // 'test364.txml', // deep initial states are not supported
    'test372.txml',
    'test375.txml',
    'test376.txml',
    'test377.txml',
    'test378.txml',
    'test387.txml',
    // 'test388.txml', // deep initial states are not supported
    'test396.txml',
    'test399.txml',
    'test401.txml',
    'test402.txml',
    'test403a.txml',
    'test403b.txml',
    'test403c.txml',
    'test404.txml',
    'test405.txml',
    'test406.txml',
    'test407.txml',
    'test409.txml',
    // 'test411.txml', // In() predicate + microstep ordering during entry
    // 'test412.txml', // initial transitions with executable content not implemented yet
    // 'test413.txml', // In() predicate with complex parallel initial states
    'test416.txml',
    'test417.txml',
    'test419.txml',
    'test421.txml',
    // 'test422.txml', // type-less <invoke> not implemented yet
    'test423.txml',
    'test436.txml',
    'test444.txml',
    'test445.txml',
    // 'test446.txml', // conversion of <data src="..."> not implemented yet
    // 'test448.txml', // nested datamodels not implemented yet
    'test449.txml',
    'test451.txml',
    // 'test452.txml', // <script> with complex timing
    'test453.txml',
    'test456.txml',
    // 'test457.txml', // <foreach> with deep copy semantics
    'test459.txml',
    'test460.txml',
    // 'test487.txml', // this has a syntax error on purpose, so it's not included
    // 'test488.txml', // donedata <param expr> error must precede done.state event; XState evaluates output during done dispatch
    'test495.txml',
    'test496.txml',
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
    'test521.txml',
    // 'test522.txml', // Basic HTTP Event I/O processor not implemented
    'test525.txml',
    'test527.txml',
    // 'test528.txml', // TODO: evaluate <donedata> before done.state so error.execution wins
    'test529.txml',
    // 'test530.txml', // <content expr="..."> dynamic invoke content not implemented
    // 'test531.txml', // Basic HTTP Event I/O processor not implemented
    // 'test532.txml', // Basic HTTP Event I/O processor not implemented
    // 'test533.txml', // we allow `reenter: false` to not leave the source state even if that source state is not compound
    // 'test534.txml', // Basic HTTP Event I/O processor not implemented
    // 'test550.txml', // non-root datamodel with early binding not implemented yet
    // 'test551.txml', // non-root datamodel with early binding not implemented yet
    // 'test552.txml', // conversion of <data src="..."> not implemented yet
    // 'test553.txml', // <send namelist="..."> not implemented
    // 'test554.txml', // <send namelist="..."> not implemented
    // 'test557.txml', // conversion of <data src="..."> not implemented yet
    // 'test558.txml', // conversion of <data src="..."> not implemented yet
    'test560.txml',
    // 'test561.txml', // processor creates an ECMAScript DOM object _event.data when receiving XML in an event
    // 'test562.txml', // test that processor creates space normalized string in _event.data when receiving anything other than KVPs or XML in an event
    // 'test567.txml', // Basic HTTP Event I/O processor not implemented
    'test569.txml',
    'test570.txml',
    // 'test576.txml', // multiple initial states not supported
    // 'test577.txml', // Basic HTTP Event I/O processor not implemented
    // 'test578.txml', // <content> in <send> not implemented yet
    // 'test579.txml', // executable content in <history>'s <transition> not implemented
    'test580.txml'
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

async function runW3TestToCompletion(
  name: string,
  scxmlDefinition: string,
  test: SCIONTest
): Promise<void> {
  const machine = toMachine(scxmlDefinition);

  const { resolve, reject, promise } = Promise.withResolvers<void>();
  let nextState: AnyMachineSnapshot;
  let prevState: AnyMachineSnapshot;

  const transitions: string[] = [];

  const actor = createActor(machine, {
    logger: () => void 0
  });
  actor.subscribe({
    next: (state) => {
      prevState = nextState;
      nextState = state;
      transitions.push(
        `${JSON.stringify(state.value)} ${JSON.stringify(state.context)}`
      );
    },
    complete: () => {
      // Add 'final' for test230.txml which does not have a 'pass' state
      if (['final', 'pass'].includes(nextState.value as string)) {
        resolve();
      } else {
        reject(
          new Error(
            `${name}: Reached "fail" state from state ${JSON.stringify(
              prevState?.value
            )}\nTransitions:\n${transitions.join('\n')}`
          )
        );
      }
    }
  });
  actor.start();
  return promise;
}

async function runTestToCompletion(
  name: string,
  scxmlDefinition: string,
  test: SCIONTest
): Promise<void> {
  toMachineJSON(scxmlDefinition);

  const machine = toMachine(scxmlDefinition);

  if (!test.events.length && test.initialConfiguration[0] === 'pass') {
    await runW3TestToCompletion(name, scxmlDefinition, test);
    return;
  }

  let done = false;
  let completedAsPass = false;
  const transitions: string[] = [];
  const actor = createActor(machine, {
    clock: new SimulatedClock()
  });

  let nextState: AnyMachineSnapshot = actor.getSnapshot();
  let prevState: AnyMachineSnapshot;
  actor.subscribe((state) => {
    prevState = nextState;
    nextState = state;
  });
  actor.subscribe({
    complete: () => {
      done = true;
      if (nextState.value === 'pass' || nextState.value === 'final') {
        completedAsPass = true;
        return;
      }
      if (nextState.value === 'fail') {
        throw new Error(
          `${name}: Reached "fail" state from state ${JSON.stringify(
            prevState?.value
          )}\nTransitions:\n${transitions.join('\n')}`
        );
      }
    }
  });
  actor.start();

  // If machine already completed during start (via always transitions or
  // synchronous internal raises), the test passes if it reached 'pass' or 'final'.
  if (done) {
    if (!completedAsPass) {
      throw new Error(
        `${name}: Machine completed in state ${JSON.stringify(
          nextState.value
        )} (expected pass/final)`
      );
    }
    return;
  }

  test.events.forEach(({ event, nextConfiguration, after }) => {
    if (done) {
      return;
    }
    if (after) {
      (actor.clock as SimulatedClock).increment(after);
    }
    if (done) {
      return;
    }
    actor.send({ type: event.name });
    transitions.push(
      `${event.name} -> ${JSON.stringify(actor.getSnapshot().value)} ${JSON.stringify(actor.getSnapshot().context)}`
    );

    const stateIds = getStateNodes(machine.root, nextState.value).map(
      (stateNode) => stateNode.id
    );

    expect(stateIds).toContain(sanitizeStateId(nextConfiguration[0]));
  });
}

describe('scxml', () => {
  const onlyTests: string[] = [
    // e.g., 'test399.txml'
  ];
  const testGroupKeys = Object.keys(testGroups);

  testGroupKeys.forEach((testGroupName) => {
    const testNames = testGroups[testGroupName];

    testNames.forEach((testName) => {
      const execTest = onlyTests.length
        ? onlyTests.includes(testName) ||
          onlyTests.includes(`${testGroupName}/${testName}`)
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
        try {
          await runTestToCompletion(
            `${testGroupName}/${testName}`,
            scxmlDefinition,
            scxmlTest
          );
        } catch (e) {
          // console.log(JSON.stringify(machine.config, null, 2));
          throw e;
        }
      });
    });
  });
});
