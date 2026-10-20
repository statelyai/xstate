import { createActor } from 'xstate';
import { createMachineFromSCXML } from '../src/index.ts';

it('runs transition content against post-exit context before entering ancestors', () => {
  const trace: unknown[] = [];
  const machine = createMachineFromSCXML(`
    <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" datamodel="ecmascript" initial="idle">
      <datamodel><data id="count" expr="0" /></datamodel>
      <state id="idle">
        <onexit><assign location="count" expr="2" /><log expr="'exit'" /></onexit>
        <transition event="GO" target="child">
          <assign location="count" expr="count + 1" /><log expr="count" />
        </transition>
      </state>
      <state id="parent" initial="child">
        <onentry><log expr="'parent:' + count" /></onentry>
        <state id="child"><onentry><log expr="'child:' + count" /></onentry></state>
      </state>
    </scxml>
  `);
  const actor = createActor(machine, {
    logger: (value) => trace.push(value)
  }).start();

  actor.send({ type: 'GO' });

  expect(actor.getSnapshot().context.count).toBe(3);
  expect(trace).toEqual(['exit', 3, 'parent:3', 'child:3']);
  actor.stop();
});

it('executes mixed targetless and targeted parallel content once in document order', () => {
  const trace: unknown[] = [];
  const machine = createMachineFromSCXML(`
    <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" datamodel="ecmascript" initial="active">
      <datamodel><data id="count" expr="0" /></datamodel>
      <parallel id="active">
        <state id="left">
          <transition event="GO"><assign location="count" expr="count + 1" /><log expr="'left:' + count" /></transition>
        </state>
        <state id="right" initial="before">
          <state id="before">
            <onexit><log expr="'exit'" /></onexit>
            <transition event="GO" target="after"><assign location="count" expr="count + 1" /><log expr="'right:' + count" /></transition>
          </state>
          <state id="after"><onentry><log expr="'entry:' + count" /></onentry></state>
        </state>
      </parallel>
    </scxml>
  `);
  const actor = createActor(machine, {
    logger: (value) => trace.push(value)
  }).start();

  actor.send({ type: 'GO' });

  expect(actor.getSnapshot().value).toEqual({
    active: { left: {}, right: 'after' }
  });
  expect(actor.getSnapshot().context.count).toBe(2);
  expect(trace).toEqual(['exit', 'left:1', 'right:2', 'entry:2']);
  actor.stop();
});

it('runs history-target content before entry and keeps history-default content after parent entry', () => {
  const trace: unknown[] = [];
  const machine = createMachineFromSCXML(`
    <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" datamodel="ecmascript" initial="off">
      <state id="off">
        <onexit><log expr="'off:exit'" /></onexit>
        <transition event="RESTORE" target="history"><log expr="'restore'" /></transition>
      </state>
      <state id="active" initial="a">
        <onentry><log expr="'active:entry'" /></onentry>
        <transition event="LEAVE" target="off" />
        <history id="history" type="deep"><transition target="a"><log expr="'default'" /></transition></history>
        <state id="a"><onentry><log expr="'a:entry'" /></onentry><transition event="NEXT" target="b" /></state>
        <state id="b"><onentry><log expr="'b:entry'" /></onentry></state>
      </state>
    </scxml>
  `);
  const actor = createActor(machine, {
    logger: (value) => trace.push(value)
  }).start();

  actor.send({ type: 'RESTORE' });
  expect(trace).toEqual([
    'off:exit',
    'restore',
    'active:entry',
    'default',
    'a:entry'
  ]);
  actor.send({ type: 'NEXT' });
  actor.send({ type: 'LEAVE' });
  trace.length = 0;
  actor.send({ type: 'RESTORE' });

  expect(actor.getSnapshot().value).toEqual({ active: 'b' });
  expect(trace).toEqual(['off:exit', 'restore', 'active:entry', 'b:entry']);
  actor.stop();
});

it('checks transition availability without executing SCXML content', () => {
  const trace: unknown[] = [];
  const probe = vi.fn();
  vi.stubGlobal('__scxmlCanProbe', probe);
  const machine = createMachineFromSCXML(`
    <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" datamodel="ecmascript" initial="idle">
      <datamodel><data id="count" expr="0" /></datamodel>
      <state id="idle">
        <transition event="GO"><script>globalThis.__scxmlCanProbe()</script><assign location="count" expr="count + 1" /><log expr="count" /></transition>
      </state>
    </scxml>
  `);
  const actor = createActor(machine, {
    logger: (value) => trace.push(value)
  }).start();
  try {
    const before = actor.getSnapshot();
    expect(before.can({ type: 'GO' })).toBe(true);
    expect(before.can({ type: 'GO' })).toBe(true);
    expect(before.context.count).toBe(0);
    expect(trace).toEqual([]);
    expect(probe).not.toHaveBeenCalled();
    actor.send({ type: 'GO' });
    expect(actor.getSnapshot().context.count).toBe(1);
    expect(trace).toEqual([1]);
    expect(probe).toHaveBeenCalledTimes(1);
  } finally {
    actor.stop();
    vi.unstubAllGlobals();
  }
});

it('isolates script mutations from prior snapshots while preserving aliases, cycles and functions', () => {
  const machine = createMachineFromSCXML(`
    <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" datamodel="ecmascript" initial="idle">
      <datamodel>
        <data id="graph" expr="(() => { const value = { items: [], sparse: Array(3), fn: () => 1 }; value.self = value; return value; })()" />
        <data id="alias" expr="graph" />
      </datamodel>
      <state id="idle"><transition event="GO"><script>graph.items.push('item')</script></transition></state>
    </scxml>
  `);
  const actor = createActor(machine).start();
  const before = actor.getSnapshot();

  actor.send({ type: 'GO' });

  const after = actor.getSnapshot();
  expect(before.context.graph.items).toEqual([]);
  expect(after.context.graph.items).toEqual(['item']);
  expect(after.context.alias).toBe(after.context.graph);
  expect(after.context.graph.self).toBe(after.context.graph);
  expect(after.context.graph.fn()).toBe(1);
  expect(after.context.graph.sparse.length).toBe(3);
  expect(0 in after.context.graph.sparse).toBe(false);
  expect(before.context.graph).not.toBe(after.context.graph);
  actor.stop();
});

it('evaluates In during transition content after exits and before entry', () => {
  const trace: unknown[] = [];
  const machine = createMachineFromSCXML(`
    <scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" datamodel="ecmascript" initial="container">
      <state id="container" initial="a">
        <state id="a"><transition event="GO" target="b"><log expr="In('a')" /><log expr="In('b')" /><log expr="In('container')" /></transition></state>
        <state id="b" />
      </state>
    </scxml>
  `);
  const actor = createActor(machine, {
    logger: (value) => trace.push(value)
  }).start();
  actor.send({ type: 'GO' });
  expect(trace).toEqual([false, false, true]);
  actor.stop();
});
