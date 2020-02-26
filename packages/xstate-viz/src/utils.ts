import {
  StateNode,
  AnyEventObject,
  TransitionDefinition,
  StateMachine,
  State
} from 'xstate';
import { flatten } from 'xstate/lib/utils';

export interface Edge<
  TContext,
  TEvent extends AnyEventObject,
  TEventType extends TEvent['type'] = string
> {
  event: TEventType;
  source: StateNode<TContext, any, TEvent>;
  target: StateNode<TContext, any, TEvent>;
  transition: TransitionDefinition<TContext, TEvent>;
}

export function getChildren(machine: StateNode): StateNode[] {
  if (!machine.states) {
    return [];
  }

  return Object.keys(machine.states).map(key => {
    return machine.states[key];
  });
}

export function getEdges(stateNode: StateNode): Array<Edge<any, any, any>> {
  const edges: Array<Edge<any, any, any>> = [];

  Object.keys(stateNode.on).forEach(eventType => {
    const transitions = stateNode.on[eventType];

    transitions.forEach(t => {
      (t.target || [stateNode]).forEach(target => {
        edges.push({
          event: eventType,
          source: stateNode,
          target,
          transition: t
        });
      });
    });
  });

  return edges;
}

export function getAllEdges(stateNode: StateNode): Array<Edge<any, any, any>> {
  const children = getChildren(stateNode);

  return flatten([
    ...getEdges(stateNode),
    ...children.map(child => getAllEdges(child))
  ]);
}

export interface Indexes {
  sources: Record<string, Array<TransitionDefinition<any, any>>>;
  targets: Record<string, Array<TransitionDefinition<any, any>>>;
  transitions: Record<string, Edge<any, any>>;
}

export function getIndexes(machine: StateMachine<any, any, any>): Indexes {
  const edges = getAllEdges(machine);

  const indexes: Indexes = {
    sources: {},
    targets: {},
    transitions: {}
  };

  edges.forEach(edge => {
    if (!indexes.sources[edge.source.id]) {
      indexes.sources[edge.source.id] = [];
    }

    indexes.sources[edge.source.id].push(edge.transition);

    if (!indexes.targets[edge.target.id]) {
      indexes.targets[edge.target.id] = [];
    }

    indexes.targets[edge.target.id].push(edge.transition);

    const serializedTransition = serializeTransition(edge.transition);

    indexes.transitions[serializedTransition] = edge;
  });

  return indexes;
}

export interface Point {
  x: number;
  y: number;
  color?: string;
}

export function pointAt(
  rect: ClientRect,
  xPos: number | 'center' | 'left' | 'right',
  yPos: number | 'center' | 'top' | 'bottom'
): Point {
  return {
    x:
      xPos === 'center'
        ? rect.left + rect.width / 2
        : typeof xPos === 'string'
        ? rect[xPos]
        : rect.left + xPos,
    y:
      yPos === 'center'
        ? rect.top + rect.height / 2
        : typeof yPos === 'string'
        ? rect[yPos]
        : yPos < 1 && yPos > 0
        ? rect.top + rect.height / yPos
        : rect.top + yPos
  };
}

export function center(rect: ClientRect): Point {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

export function relativePoint(point: Point, parentElement: Element): Point {
  const parentRect = parentElement.getBoundingClientRect();

  return {
    x: point.x - parentRect.left,
    y: point.y - parentRect.top
  };
}

export function relative(
  childRect: ClientRect,
  parentElement: Element
): ClientRect {
  const parentRect = parentElement.getBoundingClientRect();

  return {
    top: childRect.top - parentRect.top,
    right: childRect.right - parentRect.left,
    bottom: childRect.bottom - parentRect.top,
    left: childRect.left - parentRect.left,
    width: childRect.width,
    height: childRect.height
  };
}

export function serializeTransition(
  transition: TransitionDefinition<any, any>
): string {
  return `event:${transition.source.id}:${transition.eventType}:${
    transition.cond ? transition.cond.toString() : ''
  }`;
}

export function isActive(
  state: State<any, any>,
  stateNode: StateNode<any, any>
) {
  const resolvedState = stateNode.machine.resolveState(state);
  const active = resolvedState.configuration.includes(stateNode);

  return active;
}
