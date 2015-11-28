var greuler = require('../node_modules/greuler/dist/greuler.min.js');
var estado = require('../lib/index.js');

window.greuler = greuler;

window.machine = estado.machine(`
idle {
  idle
    -> err_insert_coin (SELECT)
  dispensed
    -> err_insert_coin (SELECT)
  err_insert_coin
    <- (SELECT)
} -> wait_for_select (COIN)

wait_for_select {
  idle 
    -> err_processing (COIN)
  err_processing
    <- (COIN)
} -> dispensing (SELECT)

dispensing {
  idle
    -> err_dispensing (COIN)
    -> err_dispensing (SELECT)
  err_dispensing
    <- (SELECT)
    <- (COIN)
} -> idle.dispensed (DISPENSED)
`);

var nodes = [], links = [];

function getNodes(node) {
  node.states.map((state) => {
    nodes.push({ id: state._id.join('.') });

    getNodes(state);
  });

  node.transitions.map((transition) => {
    links.push({
      source: node._id.join('.'),
      target: transition.targetState._id.join('.'),
      weight: transition.event,
    });

    node.states.filter((state) => state.initial)
      .map((state) => {
        links.push({
          source: node._id.join('.'),
          target: state._id.join('.'),
        })
      })
  });
}

getNodes(window.machine);

function transition(state, action) {
  window.m.selector.traverseAllEdgesBetween({
    source: window.machine.getState(state)._id.join('.'),
    target: window.machine.getState(window.machine.transition(state, action))._id.join('.')
  }, {
    keepStroke: false
  });
}

window.transition = transition;

window.m = greuler({
  target: '#hello-world',
  width: 900,
  height: 900,
  data: {
    nodes: nodes,
    links: links
  },
  directed: true
}).update()