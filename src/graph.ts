import { StateNode } from './index';

interface IEdge {
  action: string;
  source: StateNode;
  target: StateNode;
}
interface INodesAndEdges {
  nodes: StateNode[];
  edges: IEdge[];
}

export function getNodes(node: StateNode): StateNode[] {
  const nodes = Object.keys(node.states).reduce((accNodes, stateKey) => {
    const subState = node.states[stateKey];
    const subNodes = getNodes(node.states[stateKey]);

    accNodes.push(subState, ...subNodes);
    return accNodes;
  }, []);

  return nodes;
}

export function getEdges(
  node: StateNode,
  visited: Record<string, true> = {}
): IEdge[] {
  visited[node.key] = true;
  const subNodeEdges = Object.keys(node.states).reduce((edges, key) => {
    if (visited[key]) {
      return edges;
    }

    const subState = node.states[key];
    edges.push(...getEdges(subState, visited));
    visited[key] = true;
    return edges;
  }, []);

  if (!node.on) {
    return subNodeEdges;
  }

  const edges = Object.keys(node.on).reduce((accEdges, action) => {
    const subStateKey = node.on[action];
    const subNode = node.parent.getState(subStateKey);
    const edge = { action, source: node, target: subNode };

    accEdges.push(edge);

    if (!visited[subStateKey]) {
      accEdges.push(...getEdges(subNode, visited));
      visited[subStateKey] = true;
    }

    return accEdges;
  }, []);

  return subNodeEdges.concat(edges);
}
