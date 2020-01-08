import { StateNode, EventObject } from 'xstate';
import { keys, flatten } from 'xstate/lib/utils';

export const isLeafNode = (stateNode: StateNode<any, any, any>) =>
  stateNode.type === 'atomic' || stateNode.type === 'final';

export function getChildren<TC, TE extends EventObject>(
  stateNode: StateNode<TC, any, TE>
): Array<StateNode<TC, any, TE>> {
  return keys(stateNode.states).map(key => stateNode.states[key]);
}

export function getAllStateNodes<TC, TE extends EventObject>(
  stateNode: StateNode<TC, any, TE>
): Array<StateNode<TC, any, TE>> {
  const stateNodes = [stateNode];

  if (isLeafNode(stateNode)) {
    return stateNodes;
  }

  return stateNodes.concat(
    flatten(getChildren(stateNode).map(getAllStateNodes))
  );
}

export function getBacklinkMap(stateNode: StateNode) {
  const backlinkMap: Map<StateNode, Set<StateNode>> = new Map();

  const allStateNodes = getAllStateNodes(stateNode);

  const setBacklink = (targetNode: StateNode, sourceNode: StateNode): void => {
    if (!backlinkMap.has(targetNode)) {
      backlinkMap.set(targetNode, new Set());
    }

    backlinkMap.get(targetNode)!.add(sourceNode);
  };

  allStateNodes.forEach(sourceNode => {
    Object.keys(sourceNode.on).forEach(key => {
      const transitions = sourceNode.on[key];
      transitions.forEach(t => {
        if (!t.target) {
          return;
        }

        t.target.forEach(targetNode => {
          setBacklink(targetNode, sourceNode);
        });
      });
    });
  });

  return backlinkMap;
}
