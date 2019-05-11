import { js2xml, Element as XMLElement } from 'xml-js';
import {
  StateMachine,
  Machine,
  ActionObject,
  TransitionDefinition,
  StateNode
} from 'xstate';
import { flatten } from 'xstate/lib/utils';

function transitionToSCXML(
  transition: TransitionDefinition<any, any>,
  stateNode: StateNode
): XMLElement {
  return {
    type: 'element',
    name: 'transition',
    attributes: {
      event: transition.event,
      cond: JSON.stringify(transition.cond),
      target: (transition.target || [])
        .map(t => stateNode.parent!.getStateNode(t).id)
        .join(' '),
      type: transition.internal ? 'internal' : undefined
    }
  };
}

function doneDataToSCXML(data: any): XMLElement {
  return {
    type: 'element',
    name: 'donedata',
    elements: [
      {
        type: 'element',
        name: 'content',
        attributes: {
          expr: JSON.stringify(data)
        }
      }
    ]
  };
}

function actionsToSCXML(
  name: 'onentry' | 'onexit',
  actions: Array<ActionObject<any, any>>
): XMLElement {
  return {
    type: 'element',
    name,
    elements: actions.map<XMLElement>(action => {
      return {
        type: 'element',
        name: 'script',
        elements: [
          {
            type: 'text',
            text: JSON.stringify(action)
          }
        ]
      };
    })
  };
}

function stateNodeToSCXML(stateNode: StateNode<any, any, any>): XMLElement {
  const childStates = Object.keys(stateNode.states).map(key => {
    const childStateNode = stateNode.states[key];

    return stateNodeToSCXML(childStateNode);
  });

  const elements: XMLElement[] = [];

  const { onEntry, onExit } = stateNode;

  if (onEntry.length) {
    elements.push(actionsToSCXML('onentry', onEntry));
  }

  if (onExit.length) {
    elements.push(actionsToSCXML('onexit', onExit));
  }

  const transitionElements = flatten(
    Object.keys(stateNode.on).map(event => {
      const transitions = stateNode.on[event];

      return transitions.map(transition =>
        transitionToSCXML(transition, stateNode)
      );
    })
  );

  elements.push(...transitionElements);
  elements.push(...childStates);

  if (stateNode.type === 'final' && stateNode.data) {
    elements.push(doneDataToSCXML(stateNode.data));
  }

  return {
    type: 'element',
    name:
      stateNode.type === 'parallel'
        ? 'parallel'
        : stateNode.type === 'final'
        ? 'final'
        : 'state',
    attributes: {
      id: stateNode.id,
      initial: stateNode.initial as string
    },
    elements
  };
}

export function toSCXML(machine: StateMachine<any, any, any>): string {
  const { states } = machine;

  return js2xml(
    {
      elements: [
        {
          type: 'element',
          name: 'scxml',
          attributes: {
            xmlns: 'http://www.w3.org/2005/07/scxml',
            'xmlns:xi': 'http://www.w3.org/2001/XInclude',
            version: '1.0',
            datamodel: 'ecmascript'
          },
          elements: Object.keys(states).map<XMLElement>(key => {
            const stateNode = states[key];

            return stateNodeToSCXML(stateNode);
          })
        }
      ]
    },
    {
      spaces: 2
    }
  );
}

const pedestrianStates = {
  initial: 'walk',
  states: {
    walk: {
      on: {
        PED_COUNTDOWN: 'wait',
        TIMER: undefined // forbidden event
      }
    },
    wait: {
      on: {
        PED_COUNTDOWN: 'stop',
        TIMER: undefined // forbidden event
      }
    },
    stop: {
      type: 'final',
      data: {
        foo: 'bar'
      }
    }
  }
};

const lightMachine = Machine({
  key: 'light',
  initial: 'green',
  states: {
    green: {
      entry: 'enterGreen',
      exit: 'exitGreen',
      on: {
        TIMER: 'yellow',
        POWER_OUTAGE: 'red'
      }
    },
    yellow: {
      on: {
        TIMER: 'red',
        POWER_OUTAGE: 'red'
      },
      type: 'parallel',
      states: {
        one: {
          initial: 'inactive',
          states: {
            inactive: {},
            active: {}
          }
        },
        two: {
          initial: 'inactive',
          states: {
            inactive: {},
            active: {}
          }
        }
      }
    },
    red: {
      on: {
        TIMER: 'green',
        POWER_OUTAGE: 'red'
      },
      ...pedestrianStates
    }
  }
});

console.log(toSCXML(lightMachine));
