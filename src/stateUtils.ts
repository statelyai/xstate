import { EventObject, StateNode, StateValue } from '.';
import { keys } from '../src/utils';

type Configuration<TC, TE extends EventObject> = Iterable<
  StateNode<TC, any, TE>
>;

type AdjList<TC, TE extends EventObject> = Map<
  StateNode<TC, any, TE>,
  Array<StateNode<TC, any, TE>>
>;

function getChildren<TC, TE extends EventObject>(
  stateNode: StateNode<TC, any, TE>
): Configuration<TC, TE> {
  return keys(stateNode.states).map(key => stateNode.states[key]);
}

export function getConfiguration<TC, TE extends EventObject>(
  stateNodes: Iterable<StateNode<TC, any, TE>>
): Iterable<StateNode<TC, any, TE>> {
  const configuration = new Set(stateNodes);
  const parents: typeof configuration = new Set();

  for (const s of configuration) {
    let m = s.parent;

    while (m && !configuration.has(m)) {
      configuration.add(m);
      parents.add(m);
      m = m.parent;
    }
  }

  for (const s of configuration) {
    if (!parents.has(s)) {
      s.initialStateNodes.forEach(sn => configuration.add(sn));
    } else {
      if (s.type === 'parallel') {
        for (const child of getChildren(s)) {
          if (!configuration.has(child)) {
            configuration.add(child);

            child.initialStateNodes.forEach(sn => configuration.add(sn));
          }
        }
      }
    }
  }

  return configuration;
}

function getValueFromAdj<TC, TE extends EventObject>(
  baseNode: StateNode<TC, any, TE>,
  adjList: AdjList<TC, TE>
): StateValue {
  const stateValue = {};

  const childStateNodes = adjList.get(baseNode)!;

  if (baseNode.type === 'compound' && childStateNodes[0]!.type === 'atomic') {
    return childStateNodes[0]!.key;
  }

  childStateNodes.forEach(csn => {
    stateValue[csn.key] = getValueFromAdj(csn, adjList);
  });

  return stateValue;
}

export function getValue<TC, TE extends EventObject>(
  configuration: Configuration<TC, TE>
): StateValue {
  const adjList = new Map<StateNode, StateNode[]>();
  let rootNode;

  for (const s of configuration) {
    if (!adjList.has(s)) {
      adjList.set(s, []);
    }

    if (s.parent) {
      if (!adjList.has(s.parent)) {
        adjList.set(s.parent, []);
      }

      adjList.get(s.parent)!.push(s);
    } else {
      rootNode = s;
    }
  }

  console.log(
    [...adjList.keys()].map(key => [key.id, adjList.get(key)!.map(sn => sn.id)])
  );

  return getValueFromAdj(rootNode, adjList);
}
