import { js2xml, xml2js, Element as XMLElement } from 'xml-js';
import { Machine } from './types';
// import * as xstate from './index';
import { StateNode } from './index';
import { getEventType, mapValues } from './utils';
import * as actions from './actions';

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
  const transition: any = {
    actions: []
  };

  elements.forEach(element => {
    switch (element.name) {
      case 'raise':
        transition.actions.push(actions.raise(element.attributes!.event));
      default:
        return;
    }
  });

  return transition;
}

function toConfig(nodeJson: XMLElement, id: string) {
  let initial = nodeJson.attributes!.initial;
  let states: Record<string, any>;
  let on: Record<string, any>;

  if (nodeJson.elements) {
    const stateElements = nodeJson.elements.filter(
      element => element.name === 'state'
    );

    const transitionElements = nodeJson.elements.filter(
      element => element.name === 'transition'
    );

    const onEntryElement = nodeJson.elements.find(
      element => element.name === 'onentry'
    );

    const onExitElement = nodeJson.elements.find(
      element => element.name === 'onexit'
    );

    const initialElement = !initial
      ? nodeJson.elements.find(element => element.name === 'initial')
      : undefined;

    if (initialElement && initialElement.elements!.length) {
      initial = initialElement.elements!.find(
        element => element.name === 'transition'
      )!.attributes!.target;
    }

    states = indexedRecord(stateElements, item => `${item.attributes!.id}`);

    on = mapValues(
      indexedRecord(
        transitionElements,
        (item: any) => item.attributes.event || ''
      ),
      (value: XMLElement) => {
        return [
          {
            target: `#${value.attributes!.target}`,
            ...value.elements ? executableContent(value.elements) : undefined
          }
        ];
      }
    );

    const onEntry = onEntryElement
      ? onEntryElement.elements!.map(element => {
          switch (element.name) {
            case 'raise':
              return actions.raise(element.attributes!.event);
            default:
              return 'not-implemented';
          }
        })
      : undefined;

    const onExit = onExitElement
      ? onExitElement.elements!.map(element => {
          switch (element.name) {
            case 'raise':
              return actions.raise(element.attributes!.event);
            default:
              return 'not-implemented';
          }
        })
      : undefined;

    return {
      id,
      ...initial ? { initial } : undefined,
      ...stateElements.length
        ? { states: mapValues(states, toConfig) }
        : undefined,
      ...transitionElements.length ? { on } : undefined,
      ...onEntry ? { onEntry } : undefined,
      ...onExit ? { onExit } : undefined
    };
  }

  return { id };
}

export function toMachine(xml: string) {
  const json = xml2js(xml);

  const machineElement = json.elements.filter(
    element => element.name === 'scxml'
  )[0];

  return toConfig(machineElement, '(machine)');
}
