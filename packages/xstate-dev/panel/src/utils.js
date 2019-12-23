export function getEdges(node, options) {
  const { depth = null } = options || {};
  const edges = [];

  if (node.states && depth === null) {
    for (const stateKey of Object.keys(node.states)) {
      edges.push(...getEdges(node.states[stateKey]));
    }
  } else if (depth && depth > 0) {
    for (const stateKey of Object.keys(node.states)) {
      edges.push(
        ...getEdges(node.states[stateKey], {
          depth: depth - 1
        })
      );
    }
  }

  for (const event of Object.keys(node.on)) {
    edges.push(...node.definition.on[event]);
  }

  return edges;
}
