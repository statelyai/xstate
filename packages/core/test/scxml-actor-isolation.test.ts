import { createActor } from '../src/index.ts';
import { createMachineFromSCXML } from '../src/scxml/index.ts';

it('handles failed SCXML conditions without requiring a state entry', () => {
  const machine =
    createMachineFromSCXML(`<scxml xmlns="http://www.w3.org/2005/07/scxml" initial="a">
    <state id="a"><transition event="GO" cond="missing.name" target="b"/>
      <transition event="error.execution" target="caught"/></state>
    <state id="b"/><final id="caught"/>
  </scxml>`);
  const first = createActor(machine).start();
  first.send({ type: 'GO' });
  expect(first.getSnapshot().value).toBe('caught');
  const second = createActor(machine).start();
  expect(second.getSnapshot().value).toBe('a');
  second.stop();
});

it('does not leak unhandled condition errors into another actor', () => {
  const machine =
    createMachineFromSCXML(`<scxml xmlns="http://www.w3.org/2005/07/scxml" initial="a">
    <state id="a"><transition event="GO" cond="missing.name" target="b"/>
      <transition event="NEXT" target="b"/></state>
    <state id="b"><transition event="error.execution" target="caught"/></state><final id="caught"/>
  </scxml>`);
  const first = createActor(machine).start();
  const second = createActor(machine).start();
  first.send({ type: 'GO' });
  second.send({ type: 'NEXT' });
  expect(second.getSnapshot().value).toBe('b');
  first.stop();
  second.stop();
});

it('handles a failed eventless condition in the initial macrostep', () => {
  const machine =
    createMachineFromSCXML(`<scxml xmlns="http://www.w3.org/2005/07/scxml" initial="a">
    <state id="a"><transition cond="missing.name" target="b"/>
      <transition event="error.execution" target="caught"/></state>
    <state id="b"/><final id="caught"/>
  </scxml>`);
  const actor = createActor(machine).start();
  expect(actor.getSnapshot().value).toBe('caught');
});

it('discards failed guard probes before a real transition', () => {
  const machine =
    createMachineFromSCXML(`<scxml xmlns="http://www.w3.org/2005/07/scxml" initial="a">
    <state id="a"><transition event="PROBE" cond="missing.name" target="b"/>
      <transition event="NEXT" target="b"/></state>
    <state id="b"><transition event="error.execution" target="caught"/></state><final id="caught"/>
  </scxml>`).provide({});
  const actor = createActor(machine).start();
  expect(actor.getSnapshot().can({ type: 'PROBE' })).toBe(false);
  actor.send({ type: 'NEXT' });
  expect(actor.getSnapshot().value).toBe('b');
  actor.stop();
});
