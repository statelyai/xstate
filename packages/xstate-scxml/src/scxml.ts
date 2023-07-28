import { xml2js, Element as XMLElement } from 'xml-js';
import {
  ActionFunction,
  AnyStateMachine,
  AnyStateNode,
  assign,
  cancel,
  choose,
  ChooseBranch,
  createMachine,
  DelayExpr,
  EventObject,
  log,
  raise,
  SendExpr,
  sendTo,
  StateNodeConfig
} from 'xstate';
import { not, stateIn } from 'xstate/guards';

function appendWildcards(state: AnyStateNode) {
  const newTransitions: typeof state.transitions = new Map();

  for (const [descriptor, transitions] of state.transitions) {
    if (descriptor !== '*' && !descriptor.endsWith('.*')) {
      newTransitions.set(`${descriptor}.*`, transitions);
    } else {
      newTransitions.set(descriptor, transitions);
    }
  }

  state.transitions = newTransitions;

  for (const key of Object.keys(state.states)) {
    appendWildcards(state.states[key]);
  }
}

export function mapValues<P, O extends Record<string, unknown>>(
  collection: O,
  iteratee: (item: O[keyof O], key: keyof O, collection: O, i: number) => P
): { [key in keyof O]: P };
export function mapValues(
  collection: Record<string, unknown>,
  iteratee: (
    item: unknown,
    key: string,
    collection: Record<string, unknown>,
    i: number
  ) => unknown
) {
  const result: Record<string, unknown> = {};

  const collectionKeys = Object.keys(collection);
  for (let i = 0; i < collectionKeys.length; i++) {
    const key = collectionKeys[i];
    result[key] = iteratee(collection[key], key, collection, i);
  }

  return result;
}

function getAttribute(
  element: XMLElement,
  attribute: string
): string | number | undefined {
  return element.attributes ? element.attributes[attribute] : undefined;
}

function indexedRecord<T extends {}>(
  items: T[],
  identifierFn: (item: T) => string
): Record<string, T> {
  const record: Record<string, T> = {};

  items.forEach((item) => {
    const key = identifierFn(item);

    record[key] = item;
  });

  return record;
}

function executableContent(elements: XMLElement[]) {
  const transition: any = {
    actions: mapActions(elements)
  };

  return transition;
}

function getTargets(targetAttr?: string | number): string[] | undefined {
  // return targetAttr ? [`#${targetAttr}`] : undefined;
  return targetAttr
    ? `${targetAttr}`.split(/\s+/).map((target) => `#${target}`)
    : undefined;
}

function delayToMs(delay?: string | number): number | undefined {
  if (!delay) {
    return undefined;
  }

  if (typeof delay === 'number') {
    return delay;
  }

  const millisecondsMatch = delay.match(/(\d+)ms/);

  if (millisecondsMatch) {
    return parseInt(millisecondsMatch[1], 10);
  }

  const secondsMatch = delay.match(/(\d*)(\.?)(\d+)s/);

  if (secondsMatch) {
    const hasDecimal = !!secondsMatch[2];
    if (!hasDecimal) {
      return parseInt(secondsMatch[3], 10) * 1000;
    }
    const secondsPart = !!secondsMatch[1]
      ? parseInt(secondsMatch[1], 10) * 1000
      : 0;
    const millisecondsPart = parseInt(
      (secondsMatch[3] as any).padEnd(3, '0'),
      10
    );

    if (millisecondsPart >= 1000) {
      throw new Error(`Can't parse "${delay} delay."`);
    }

    return secondsPart + millisecondsPart;
  }

  throw new Error(`Can't parse "${delay} delay."`);
}

const evaluateExecutableContent = <
  TContext extends object,
  TEvent extends EventObject
>(
  context: TContext,
  event: TEvent,
  _meta: any,
  body: string
) => {
  const datamodel = context
    ? Object.keys(context)
        .map((key) => `const ${key} = context['${key}'];`)
        .join('\n')
    : '';

  const scope = ['const _sessionid = "NOT_IMPLEMENTED";', datamodel]
    .filter(Boolean)
    .join('\n');

  const args = ['context', '_event'];

  const fnBody = `
    ${scope}
    ${body}
  `;

  const fn = new Function(...args, fnBody);
  return fn(context, { name: event.type, data: event });
};

function createGuard<
  TContext extends object,
  TEvent extends EventObject = EventObject
>(guard: string) {
  return ({
    context,
    event,
    ...meta
  }: {
    context: TContext;
    event: TEvent;
  }) => {
    return evaluateExecutableContent(
      context,
      event,
      meta as any,
      `return ${guard};`
    );
  };
}

function mapAction(element: XMLElement): ActionFunction<any, any, any, any> {
  switch (element.name) {
    case 'raise': {
      return raise({
        type: element.attributes!.event!
      });
    }
    case 'assign': {
      return assign(({ context, event, ...meta }) => {
        const fnBody = `
            return {'${element.attributes!.location}': ${
          element.attributes!.expr
        }};
          `;

        return evaluateExecutableContent(context, event, meta, fnBody);
      });
    }
    case 'cancel':
      if ('sendid' in element.attributes!) {
        return cancel(element.attributes!.sendid! as string);
      }
      return cancel(({ context, event, ...meta }) => {
        const fnBody = `
            return ${element.attributes!.sendidexpr};
          `;

        return evaluateExecutableContent(context, event, meta, fnBody);
      });
    case 'send': {
      const { event, eventexpr, target, id } = element.attributes!;

      let convertedEvent: EventObject | SendExpr<any, any>;
      let convertedDelay: number | DelayExpr<any, any> | undefined;

      const params =
        element.elements &&
        element.elements.reduce((acc, child) => {
          if (child.name === 'content') {
            throw new Error(
              'Conversion of <content/> inside <send/> not implemented.'
            );
          }
          return `${acc}${child.attributes!.name}:${child.attributes!.expr},\n`;
        }, '');

      if (event && !params) {
        convertedEvent = { type: event as string };
      } else {
        convertedEvent = ({ context, event, ...meta }) => {
          const fnBody = `
              return { type: ${event ? `"${event}"` : eventexpr}, ${
            params ? params : ''
          } }
            `;

          return evaluateExecutableContent(context, event, meta, fnBody);
        };
      }

      if ('delay' in element.attributes!) {
        convertedDelay = delayToMs(element.attributes!.delay);
      } else if (element.attributes!.delayexpr) {
        convertedDelay = ({ context, event, ...meta }) => {
          const fnBody = `
              return (${delayToMs})(${element.attributes!.delayexpr});
            `;

          return evaluateExecutableContent(context, event, meta, fnBody);
        };
      }

      const scxmlParams = {
        delay: convertedDelay,
        id: id as string | undefined
      };

      if (target) {
        return sendTo(target as string, convertedEvent, scxmlParams);
      }

      return raise(convertedEvent, {
        delay: convertedDelay,
        id: id as string | undefined
      });
    }
    case 'log': {
      const label = element.attributes!.label;

      return log(
        ({ context, event, ...meta }) => {
          const fnBody = `
              return ${element.attributes!.expr};
            `;

          return evaluateExecutableContent(context, event, meta, fnBody);
        },
        label !== undefined ? String(label) : undefined
      );
    }
    case 'if': {
      const branches: Array<ChooseBranch<any, any>> = [];

      let current: ChooseBranch<any, any> = {
        guard: createGuard(element.attributes!.cond as string),
        actions: []
      };

      for (const el of element.elements!) {
        if (el.type === 'comment') {
          continue;
        }

        switch (el.name) {
          case 'elseif':
            branches.push(current);
            current = {
              guard: createGuard(el.attributes!.cond as string),
              actions: []
            };
            break;
          case 'else':
            branches.push(current);
            current = { actions: [] };
            break;
          default:
            (current.actions as any[]).push(mapAction(el));
            break;
        }
      }

      branches.push(current);
      return choose(branches);
    }
    default:
      throw new Error(
        `Conversion of "${element.name}" elements is not implemented yet.`
      );
  }
}

function mapActions(
  elements: XMLElement[]
): ActionFunction<any, any, any, any>[] {
  const mapped: ActionFunction<any, any, any, any>[] = [];

  for (const element of elements) {
    if (element.type === 'comment') {
      continue;
    }

    mapped.push(mapAction(element));
  }

  return mapped;
}

type HistoryAttributeValue = 'shallow' | 'deep' | undefined;

function toConfig(
  nodeJson: XMLElement,
  id: string
): StateNodeConfig<any, any, any, any> {
  const parallel = nodeJson.name === 'parallel';
  let initial = parallel ? undefined : nodeJson.attributes!.initial;
  const { elements } = nodeJson;

  switch (nodeJson.name) {
    case 'history': {
      const history =
        (getAttribute(nodeJson, 'type') as HistoryAttributeValue) || 'shallow';

      if (!elements) {
        return {
          id,
          history
        };
      }

      const [transitionElement] = elements.filter(
        (element) => element.name === 'transition'
      );

      const target = getAttribute(transitionElement, 'target');

      return {
        id,
        history,
        target: target ? `#${target}` : undefined
      };
    }
    default:
      break;
  }

  if (nodeJson.elements) {
    const stateElements = nodeJson.elements.filter(
      (element) =>
        element.name === 'state' ||
        element.name === 'parallel' ||
        element.name === 'final' ||
        element.name === 'history'
    );

    const transitionElements = nodeJson.elements.filter(
      (element) => element.name === 'transition'
    );

    const invokeElements = nodeJson.elements.filter(
      (element) => element.name === 'invoke'
    );

    const onEntryElements = nodeJson.elements.filter(
      (element) => element.name === 'onentry'
    );

    const onExitElements = nodeJson.elements.filter(
      (element) => element.name === 'onexit'
    );

    const states: Record<string, any> = indexedRecord(
      stateElements,
      (item) => `${item.attributes!.id}`
    );

    const initialElement = !initial
      ? nodeJson.elements.find((element) => element.name === 'initial')
      : undefined;

    if (initialElement && initialElement.elements!.length) {
      initial = initialElement.elements!.find(
        (element) => element.name === 'transition'
      )!.attributes!.target;
    } else if (!initial && !initialElement && stateElements.length) {
      initial = stateElements[0].attributes!.id;
    }

    const always: any[] = [];
    const on: Record<string, any> = {};

    transitionElements.flatMap((value) => {
      const events = ((getAttribute(value, 'event') as string) || '').split(
        /\s+/
      );

      return events.map((event) => {
        const targets = getAttribute(value, 'target');
        const internal = getAttribute(value, 'type') === 'internal';

        let guardObject = {};

        if (value.attributes?.cond) {
          const guard = value.attributes!.cond;
          if ((guard as string).startsWith('In')) {
            const inMatch = (guard as string).trim().match(/^In\('(.*)'\)/);

            if (inMatch) {
              guardObject = {
                guard: stateIn(`#${inMatch[1]}`)
              };
            }
          } else if ((guard as string).startsWith('!In')) {
            const notInMatch = (guard as string).trim().match(/^!In\('(.*)'\)/);

            if (notInMatch) {
              guardObject = {
                guard: not(stateIn(`#${notInMatch[1]}`))
              };
            }
          } else {
            guardObject = {
              guard: createGuard(value.attributes!.cond as string)
            };
          }
        }

        const transitionConfig = {
          target: getTargets(targets),
          ...(value.elements ? executableContent(value.elements) : undefined),
          ...guardObject,
          internal
        };

        if (event === '') {
          always.push(transitionConfig);
        } else {
          let existing = on[event];
          if (!existing) {
            existing = [];
            on[event] = existing;
          }
          existing.push(transitionConfig);
        }
      });
    });

    const onEntry = onEntryElements
      ? onEntryElements.flatMap((onEntryElement) =>
          mapActions(onEntryElement.elements!)
        )
      : undefined;

    const onExit = onExitElements
      ? onExitElements.flatMap((onExitElement) =>
          mapActions(onExitElement.elements!)
        )
      : undefined;

    const invoke = invokeElements.map((element) => {
      if (
        !['scxml', 'http://www.w3.org/TR/scxml/'].includes(
          element.attributes!.type as string
        )
      ) {
        throw new Error(
          'Currently only converting invoke elements of type SCXML is supported.'
        );
      }
      const content = element.elements!.find(
        (el) => el.name === 'content'
      ) as XMLElement;

      return {
        ...(element.attributes!.id && { id: element.attributes!.id as string }),
        src: scxmlToMachine(content)
      };
    });

    return {
      id,
      ...(initial
        ? {
            initial: String(initial)
              .split(' ')
              .map((id) => `#${id}`)
          }
        : undefined),
      ...(parallel ? { type: 'parallel' } : undefined),
      ...(nodeJson.name === 'final' ? { type: 'final' } : undefined),
      ...(stateElements.length
        ? {
            states: mapValues(states, (state, key) => toConfig(state, key))
          }
        : undefined),
      on,
      ...(onEntry ? { entry: onEntry } : undefined),
      ...(onExit ? { exit: onExit } : undefined),
      ...(invoke.length ? { invoke } : undefined)
    };
  }

  return { id, ...(nodeJson.name === 'final' ? { type: 'final' } : undefined) };
}

function scxmlToMachine(scxmlJson: XMLElement): AnyStateMachine {
  const machineElement = scxmlJson.elements!.find(
    (element) => element.name === 'scxml'
  ) as XMLElement;

  const dataModelEl = machineElement.elements!.filter(
    (element) => element.name === 'datamodel'
  )[0];

  const context = dataModelEl
    ? dataModelEl
        .elements!.filter((element) => element.name === 'data')
        .reduce((acc, element) => {
          const { src, expr, id } = element.attributes!;
          if (src) {
            throw new Error(
              "Conversion of `src` attribute on datamodel's <data> elements is not supported."
            );
          }

          if (expr === '_sessionid') {
            acc[id!] = undefined;
          } else {
            acc[id!] = eval(`(${expr})`);
          }

          return acc;
        }, {} as Record<string, unknown>)
    : undefined;

  const machine = createMachine({
    ...toConfig(machineElement, '(machine)'),
    context
  } as any);

  appendWildcards(machine.root);

  return machine;
}

export function toMachine(xml: string): AnyStateMachine {
  const json = xml2js(xml) as XMLElement;
  return scxmlToMachine(json);
}
