import { js2xml, xml2js, Element as XMLElement } from 'xml-js';
import { EventObject, ActionObject } from './types';
// import * as xstate from './index';
import { StateNode, Machine } from './index';
import { mapValues, getActionType } from './utils';
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
              event: getActionType(event)
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
              event: getActionType(event)
            }
          };
        })
      },
      ...Object.keys(stateNode.states).map(stateKey => {
        const subStateNode = stateNode.states[stateKey];

        return stateNodeToSCXML(subStateNode);
      }),
      ...Object.keys(stateNode.on)
        .map(
          (event): XMLElement[] => {
            const transition = stateNode.on![event];

            if (!transition) {
              return [];
            }

            if (Array.isArray(transition)) {
              return transition.map(targetTransition => {
                const { target } = targetTransition;

                return {
                  type: 'element',
                  name: 'transition',
                  attributes: {
                    ...(event ? { event } : undefined),
                    ...(target
                      ? {
                          target: stateNode.parent!.getRelativeStateNodes(
                            target
                          )[0]!.id
                        }
                      : undefined), // TODO: fixme
                    ...(targetTransition.cond
                      ? { cond: targetTransition.cond.toString() }
                      : undefined)
                  },
                  elements: targetTransition.actions
                    ? targetTransition.actions.map(action => ({
                        type: 'element',
                        name: 'send',
                        attributes: {
                          event: getActionType(action)
                        }
                      }))
                    : undefined
                };
              });
            }

            return Object.keys(transition).map(target => {
              const targetTransition = transition[target];

              return {
                type: 'element',
                name: 'transition',
                attributes: {
                  ...(event ? { event } : undefined),
                  target: stateNode.parent!.getRelativeStateNodes(target)![0]
                    .id, // TODO: fixme
                  ...(targetTransition.cond
                    ? { cond: targetTransition.cond.toString() }
                    : undefined)
                },
                elements: targetTransition.actions
                  ? targetTransition.actions.map(action => ({
                      type: 'element',
                      name: 'send',
                      attributes: {
                        event: getActionType(action)
                      }
                    }))
                  : undefined
              };
            });
          }
        )
        .reduce((a, b) => a.concat(b))
    ].filter(Boolean) as XMLElement[]
  };

  return scxmlElement;
}

export function fromMachine(machine: StateNode): string {
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
    const key = identifierFn(item);

    record[key] = item;
  });

  return record;
}

function indexedAggregateRecord<T extends {}>(
  items: T[],
  identifier: string | ((item: T) => string)
): Record<string, T[]> {
  const record: Record<string, T[]> = {};

  const identifierFn =
    typeof identifier === 'string' ? item => item[identifier] : identifier;

  items.forEach(item => {
    const key = identifierFn(item);

    (record[key] = record[key] || ([] as T[])).push(item);
  });

  return record;
}

function executableContent(elements: XMLElement[]) {
  const transition: any = {
    actions: mapActions(elements)
  };

  return transition;
}

function mapActions<TContext>(
  elements: XMLElement[]
): Array<ActionObject<TContext>> {
  return elements.map(element => {
    switch (element.name) {
      case 'raise':
        return actions.raise(element.attributes!.event!);
      case 'assign':
        return actions.assign(xs => {
          const literalKeyExprs = xs
            ? Object.keys(xs)
                .map(key => `const ${key} = xs['${key}'];`)
                .join('\n')
            : '';
          const fnStr = `
          const xs = arguments[0];
          ${literalKeyExprs};
            return {'${element.attributes!.location}': ${
            element.attributes!.expr
          }};
          `;

          const fn = new Function(fnStr);
          return fn(xs);
        });
      default:
        return { type: 'not-implemented' };
    }
  });
}

function toConfig(
  nodeJson: XMLElement,
  id: string,
  options: ScxmlToMachineOptions,
  extState?: {}
) {
  const { evalCond } = options;
  const parallel = nodeJson.name === 'parallel';
  let initial = parallel ? undefined : nodeJson.attributes!.initial;
  let states: Record<string, any>;
  let on: Record<string, any>;
  const { elements } = nodeJson;

  switch (nodeJson.name) {
    case 'history': {
      if (!elements) {
        return {
          id,
          history: nodeJson.attributes!.type || 'shallow'
        };
      }

      const [transitionElement] = elements.filter(
        element => element.name === 'transition'
      );

      return {
        id,
        history: nodeJson.attributes!.type || 'shallow',
        target: `#${transitionElement.attributes!.target}`
      };
    }
    default:
      break;
  }

  if (nodeJson.elements) {
    const stateElements = nodeJson.elements.filter(
      element =>
        element.name === 'state' ||
        element.name === 'parallel' ||
        element.name === 'history'
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
      indexedAggregateRecord(
        transitionElements,
        (item: any) => item.attributes.event || ''
      ),
      (values: XMLElement[]) => {
        return values.map(value => ({
          target: `#${value.attributes!.target}`,
          ...(value.elements ? executableContent(value.elements) : undefined),
          ...(value.attributes!.cond
            ? {
                cond: evalCond(value.attributes!.cond as string, extState)
              }
            : undefined)
        }));
      }
    );

    const onEntry = onEntryElement
      ? mapActions(onEntryElement.elements!)
      : undefined;

    const onExit = onExitElement
      ? mapActions(onExitElement.elements!)
      : undefined;

    return {
      id,
      ...(initial ? { initial } : undefined),
      ...(parallel ? { parallel } : undefined),
      ...(stateElements.length
        ? {
            states: mapValues(states, (state, key) =>
              toConfig(state, key, options, extState)
            )
          }
        : undefined),
      ...(transitionElements.length ? { on } : undefined),
      ...(onEntry ? { onEntry } : undefined),
      ...(onExit ? { onExit } : undefined)
    };
  }

  return { id };
}

export interface ScxmlToMachineOptions {
  evalCond: (
    expr: string,
    extState?: object
  ) => // tslint:disable-next-line:ban-types
  ((extState: any, event: EventObject) => boolean) | Function;
  delimiter?: string;
}

export function toMachine(
  xml: string,
  options: ScxmlToMachineOptions
): StateNode {
  const json = xml2js(xml) as XMLElement;

  const machineElement = json.elements!.filter(
    element => element.name === 'scxml'
  )[0];

  const dataModelEl = machineElement.elements!.filter(
    element => element.name === 'datamodel'
  )[0];

  const extState = dataModelEl
    ? dataModelEl.elements!.reduce((acc, element) => {
        acc[element.attributes!.id!] = element.attributes!.expr;
        return acc;
      }, {})
    : undefined;

  // console.log(dataModelEl, extState);

  return Machine(
    {
      ...toConfig(machineElement, '(machine)', options, extState),
      delimiter: options.delimiter
    },
    undefined,
    extState
  );
}
