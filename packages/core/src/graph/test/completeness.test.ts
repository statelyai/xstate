import { createMachine } from '../../index.ts';
import { toDirectedGraph } from '../index.ts';

it('reports dynamic destinations without executing transition functions', () => {
  const decide = vi.fn(() => ({ target: 'done' }));
  const machine = createMachine({
    id: 'flow',
    initial: 'idle',
    states: {
      idle: { on: { GO: decide } },
      done: { type: 'final' }
    }
  });
  const graph = toDirectedGraph(machine);
  expect(decide).not.toHaveBeenCalled();
  expect(graph.children[0].edges).toEqual([]);
  expect(graph.analysis.transitionTargetsComplete).toBe(false);
  expect(graph.analysis.diagnostics).toEqual([
    expect.objectContaining({
      code: 'dynamic-target',
      stateId: 'flow.idle',
      eventType: 'GO',
      transitionId: 'flow.idle:0'
    })
  ]);
  expect(JSON.parse(JSON.stringify(graph)).analysis).toEqual(graph.analysis);
  expect(graph.children[1].analysis.transitionTargetsComplete).toBe(true);
});

it('includes static eventless transitions and reports dynamic choices', () => {
  const machine = createMachine({
    initial: 'idle',
    states: {
      idle: { always: { target: 'route' } },
      route: { type: 'choice', choice: () => ({ target: 'done' }) },
      done: { type: 'final' }
    }
  });
  const graph = toDirectedGraph(machine);
  expect(graph.children[0].edges.map((edge) => edge.target.id)).toEqual([
    'route'
  ]);
  expect(graph.children[0].analysis.transitionTargetsComplete).toBe(true);
  expect(graph.analysis.diagnostics).toEqual([
    expect.objectContaining({
      code: 'dynamic-target',
      stateId: 'route',
      eventType: ''
    })
  ]);
});

it('does not claim that statically known targets prove guard reachability', () => {
  const machine = createMachine({
    initial: 'idle',
    states: {
      idle: { on: { GO: { target: 'done' } } },
      done: { type: 'final' }
    }
  });
  expect(toDirectedGraph(machine).analysis).toEqual({
    transitionTargetsComplete: true,
    diagnostics: []
  });
});
