import { js2xml, xml2js, Element as XMLElement } from 'xml-js';
import { Machine } from './types';
// import * as xstate from './index';
import { StateNode } from './index';
import { getEventType, mapValues } from './utils';

// const pedestrianStates = {
//   initial: 'walk',
//   states: {
//     walk: {
//       on: {
//         PED_COUNTDOWN: 'wait'
//       }
//     },
//     wait: {
//       on: {
//         PED_COUNTDOWN: 'stop'
//       }
//     },
//     stop: {}
//   }
// };

// const lightMachine = xstate.Machine({
//   key: 'light',
//   initial: 'green',
//   states: {
//     green: {
//       on: {
//         TIMER: 'yellow',
//         POWER_OUTAGE: 'red'
//       }
//     },
//     yellow: {
//       on: {
//         TIMER: 'red',
//         POWER_OUTAGE: 'red'
//       }
//     },
//     red: {
//       on: {
//         TIMER: 'green',
//         POWER_OUTAGE: 'red'
//       },
//       ...pedestrianStates
//     }
//   }
// });

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

export function fromMachine(machine: Machine) {
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

function indexedRecord<T extends {}>(
  items: T[],
  identifier: string | ((item: T) => string)
): Record<string, T> {
  const record: Record<string, T> = {};

  const identifierFn =
    typeof identifier === 'string' ? item => item[identifier] : identifier;

  items.forEach(item => {
    record[identifierFn(item)] = item;
  });

  return record;
}

function executableContent(elements: XMLElement[]) {
  const transition: any = {};

  elements.forEach(element => {
    switch (element.name) {
      case 'raise':
        transition.raise = transition.raise || [];
        transition.raise.push(element.attributes!.event);
      default:
        return;
    }
  });

  return transition;
}

function toConfig(nodeJson: XMLElement) {
  const initial = nodeJson.attributes!.initial;
  let states: Record<string, any>;
  let on: Record<string, any>;

  if (nodeJson.elements) {
    const stateElements = nodeJson.elements.filter(
      element => element.name === 'state'
    );

    const transitionElements = nodeJson.elements.filter(
      element => element.name === 'transition'
    );

    states = indexedRecord(stateElements, item => `${item.attributes!.id}`);

    on = mapValues(
      indexedRecord(
        transitionElements,
        (item: any) => item.attributes.event || ''
      ),
      (value: XMLElement) => {
        return {
          target: value.attributes!.target,
          ...value.elements ? executableContent(value.elements) : undefined
        };
      }
    );

    return {
      initial,
      ...stateElements.length
        ? { states: mapValues(states, toConfig) }
        : undefined,
      ...transitionElements.length ? { on } : undefined
    };
  }

  return {};
}

export function toMachine(xml: string) {
  const json = xml2js(xml);

  const machineElement = json.elements.filter(
    element => element.name === 'scxml'
  )[0];

  return toConfig(machineElement);
}
