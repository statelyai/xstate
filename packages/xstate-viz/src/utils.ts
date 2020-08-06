import {
  StateNode,
  TransitionDefinition,
  StateMachine,
  State,
  ActionObject,
  StateValue,
} from "xstate";
import { flatten } from "xstate/lib/utils";
import { Edge } from "./types";

export function getChildren(stateNode: StateNode): StateNode[] {
  if (!stateNode.states) {
    return [];
  }

  const children = Object.keys(stateNode.states).map((key) => {
    return stateNode.states[key];
  });

  children.sort((a, b) => b.order - a.order);

  return children;
}

export function getEdges(stateNode: StateNode): Array<Edge<any, any, any>> {
  const edges: Array<Edge<any, any, any>> = [];

  Object.keys(stateNode.on).forEach((eventType) => {
    const transitions = stateNode.on[eventType];

    transitions.forEach((t) => {
      const targets = t.target && t.target.length > 0 ? t.target : [stateNode];
      targets.forEach((target) => {
        edges.push({
          event: eventType,
          source: stateNode,
          target,
          transition: t,
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
    ...children.map((child) => getAllEdges(child)),
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
    transitions: {},
  };

  edges.forEach((edge) => {
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
  xPos: number | "center" | "left" | "right",
  yPos: number | "center" | "top" | "bottom"
): Point {
  return {
    x:
      xPos === "center"
        ? rect.left + rect.width / 2
        : typeof xPos === "string"
        ? rect[xPos]
        : rect.left + xPos,
    y:
      yPos === "center"
        ? rect.top + rect.height / 2
        : typeof yPos === "string"
        ? rect[yPos]
        : yPos < 1 && yPos > 0
        ? rect.top + rect.height / yPos
        : rect.top + yPos,
  };
}

export function center(rect: ClientRect): Point {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function relativePoint(point: Point, parentElement: Element): Point {
  const parentRect = parentElement.getBoundingClientRect();

  return {
    x: point.x - parentRect.left,
    y: point.y - parentRect.top,
  };
}

export function serializeTransition(
  transition: TransitionDefinition<any, any>
): string {
  const index = transition.source.transitions.indexOf(transition);
  const condString = transition.cond?.predicate?.toString() || "";
  return `event:${transition.source.id}:${transition.eventType}:${index}`;
}

export function isActive(
  state: State<any, any>,
  stateNode: StateNode<any, any>
) {
  // TODO: remove try/catch
  try {
    const resolvedState = stateNode.machine.resolveState(state);
    const active = resolvedState.configuration.includes(stateNode);

    return active;
  } catch {
    return false;
  }
}

export function serializeAction(action: ActionObject<any, any>): string {
  return JSON.stringify(action);
}

export function isBuiltinEvent(eventType: string): boolean {
  return (
    eventType.startsWith("xstate.") ||
    eventType.startsWith("done.state.") ||
    eventType.startsWith("error.execution.") ||
    eventType.startsWith("error.platform.")
  );
}

export function toDelayString(delay: string | number): string {
  if (typeof delay === "number" || !isNaN(+delay)) {
    return `${delay}ms`;
  }
  return delay;
}

export function getLevel(stateNode: StateNode<any, any, any>): number {
  let level = 0;

  let marker = stateNode.parent;

  while (marker) {
    level++;
    marker = marker.parent;
  }

  return level;
}

export const getPartialStateValue = (
  stateNode: StateNode<any, any>,
  prev?: StateValue
): StateValue => {
  if (!stateNode.parent) {
    return prev!;
  }

  return getPartialStateValue(
    stateNode.parent,
    prev
      ? {
          [stateNode.key]: prev,
        }
      : stateNode.key
  );
};

export function slidingWindow<T, N extends number, U>(
  items: T[],
  length: N,
  fn: (
    itemsWindow: T[] & { length: N },
    index: number,
    allItems: typeof items
  ) => U[]
): U[] {
  const result: U[] = [];

  for (let i = 0; i <= items.length - length; i++) {
    const itemsWindow = [...items].slice(i, i + length);

    if (itemsWindow.length < length) {
      continue;
    }

    result.push(...fn(itemsWindow as T[] & { length: N }, i, items));
  }

  return result;
}
