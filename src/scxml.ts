import { js2xml, Element as XMLElement } from 'xml-js';
import { Machine } from './types';
import * as xstate from './index';
import { StateNode } from './index';
import { getEventType } from './utils';

const pedestrianStates = {
  initial: 'walk',
  states: {
    walk: {
      on: {
        PED_COUNTDOWN: 'wait'
      }
    },
    wait: {
      on: {
        PED_COUNTDOWN: 'stop'
      }
    },
    stop: {}
  }
};

const lightMachine = xstate.Machine({
  key: 'light',
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: 'yellow',
        POWER_OUTAGE: 'red'
      }
    },
    yellow: {
      on: {
        TIMER: 'red',
        POWER_OUTAGE: 'red'
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

function stateNodeToSCXML(stateNode: StateNode) {
  const { parallel } = stateNode;

  const scxmlElement: XMLElement = {
    type: 'element',
    name: parallel ? 'parallel' : 'state',
    attributes: {
      id: stateNode.id
    },
    elements: [
      !parallel && stateNode.initial
        ? {
            type: 'element',
            name: 'initial',
            elements: [
              {
                type: 'element',
                name: 'transition',
                attributes: {
                  target: stateNode.states[stateNode.initial].id
                }
              }
            ]
          }
        : undefined,
      stateNode.onEntry && {
        type: 'element',
        name: 'onentry',
        elements: stateNode.onEntry.map(event => {
          return {
            type: 'element',
            name: 'send',
            attributes: {
              event: getEventType(event)
            }
          };
        })
      },
      stateNode.onExit && {
        type: 'element',
        name: 'onexit',
        elements: stateNode.onExit.map(event => {
          return {
            type: 'element',
            name: 'send',
            attributes: {
              event: getEventType(event)
            }
          };
        })
      },
      ...Object.keys(stateNode.states).map(stateKey => {
        const subStateNode = stateNode.states[stateKey];

        return stateNodeToSCXML(subStateNode);
      }),
      ...(stateNode.on
        ? Object.keys(stateNode.on)
            .map((event): XMLElement[] => {
              const transition = stateNode.on![event];

              if (!transition) {
                return [];
              }

              if (Array.isArray(transition)) {
                return transition.map(targetTransition => {
                  return {
                    type: 'element',
                    name: 'transition',
                    attributes: {
                      ...event ? { event } : undefined,
                      target: stateNode.parent!.getState(
                        targetTransition.target
                      )!.id,
                      ...targetTransition.cond
                        ? { cond: targetTransition.cond.toString() }
                        : undefined
                    },
                    elements: targetTransition.actions
                      ? targetTransition.actions.map(action => ({
                          type: 'element',
                          name: 'send',
                          attributes: {
                            event: getEventType(action)
                          }
                        }))
                      : undefined
                  };
                });
              }

              if (typeof transition === 'string') {
                return [
                  {
                    type: 'element',
                    name: 'transition',
                    attributes: {
                      ...event ? { event } : undefined,
                      target: stateNode.parent!.getState(stateNode.on![
                        event
                      ] as string)!.id
                    }
                  }
                ];
              }

              return Object.keys(transition).map(target => {
                const targetTransition = transition[target];

                return {
                  type: 'element',
                  name: 'transition',
                  attributes: {
                    ...event ? { event } : undefined,
                    target: stateNode.parent!.getState(target)!.id,
                    ...targetTransition.cond
                      ? { cond: targetTransition.cond.toString() }
                      : undefined
                  },
                  elements: targetTransition.actions
                    ? targetTransition.actions.map(action => ({
                        type: 'element',
                        name: 'send',
                        attributes: {
                          event: getEventType(action)
                        }
                      }))
                    : undefined
                };
              });
            })
            .reduce((a, b) => a.concat(b))
        : [])
    ].filter(Boolean) as XMLElement[]
  };

  return scxmlElement;
}

export function toSCXML(machine: Machine) {
  const scxmlDocument: XMLElement = {
    declaration: { attributes: { version: '1.0', encoding: 'utf-8' } },
    elements: [
      { type: 'instruction', name: 'access-control', instruction: 'allow="*"' },
      {
        type: 'element',
        name: 'scxml',
        attributes: {
          version: '1.0',
          initial: machine.id
        }
      },
      stateNodeToSCXML(machine)
    ]
  };

  return js2xml(scxmlDocument, { spaces: 2 });
}

console.log(toSCXML(lightMachine));
