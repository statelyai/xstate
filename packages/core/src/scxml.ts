import { Element as XMLElement, xml2js } from 'xml-js';
import { assign } from './actions/assign.ts';
import { cancel } from './actions/cancel.ts';
import { log } from './actions/log.ts';
import { raise } from './actions/raise.ts';
import { sendTo } from './actions/send.ts';
import { NULL_EVENT } from './constants.ts';
import { not, stateIn } from './guards.ts';
import {
  ActionFunction,
  MachineContext,
  SpecialTargets,
  createMachine,
  enqueueActions
} from './index.ts';
import {
  AnyStateMachine,
  AnyStateNode,
  AnyStateNodeConfig,
  DelayExpr,
  EventObject,
  SendExpr
} from './types.ts';
import { mapValues } from './utils.ts';

export function sanitizeStateId(id: string) {
  return id.replace(/\./g, '$');
}

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
    ? `${targetAttr}`
        .split(/\s+/)
        .map((target) => `#${sanitizeStateId(target)}`)
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
  body: string,
  ...extraArgs: any[]
) => {
  const scope = ['const _sessionid = "NOT_IMPLEMENTED";']
    .filter(Boolean)
    .join('\n');

  const args = ['context', '_event'];

  const fnBody = `
${scope}
with (context) {
  ${body}
}
  `;

  const fn = new Function(...args, ...extraArgs, fnBody);

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

function mapAction(
  element: XMLElement
): ActionFunction<any, any, any, any, any, any, any, any> {
  switch (element.name) {
    case 'raise': {
      return raise({
        type: element.attributes!.event as string
      });
    }
    case 'assign': {
      return assign(({ context, event, ...meta }) => {
        const fnBody = `

${element.attributes!.location};

return {'${element.attributes!.location}': ${element.attributes!.expr}};
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

      let convertedEvent:
        | EventObject
        | SendExpr<
            MachineContext,
            EventObject,
            undefined,
            EventObject,
            EventObject
          >;
      let convertedDelay:
        | number
        | DelayExpr<MachineContext, EventObject, undefined, EventObject>
        | undefined;

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
        convertedEvent = ({ context, event: _ev, ...meta }) => {
          const fnBody = `
return { type: ${event ? `"${event}"` : eventexpr}, ${params ? params : ''} }
            `;

          return evaluateExecutableContent(context, _ev, meta, fnBody);
        };
      }

      if ('delay' in element.attributes!) {
        convertedDelay = delayToMs(element.attributes!.delay);
      } else if (element.attributes!.delayexpr) {
        convertedDelay = ({ context, event: _ev, ...meta }) => {
          const fnBody = `
return (${delayToMs})(${element.attributes!.delayexpr});
            `;

          return evaluateExecutableContent(context, _ev, meta, fnBody);
        };
      }

      if (target === SpecialTargets.Internal) {
        return raise(convertedEvent);
      }

      return sendTo(
        typeof target === 'string' ? target : ({ self }) => self,
        convertedEvent,
        {
          delay: convertedDelay,
          id: id as string | undefined
        }
      );
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
      const branches: Array<{
        guard?: (...args: any) => any;
        actions: any[];
      }> = [];

      let current: (typeof branches)[number] = {
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

      return enqueueActions(({ context, event, enqueue, check, ...meta }) => {
        for (const branch of branches) {
          if (!branch.guard || check(branch.guard)) {
            branch.actions.forEach(enqueue);
            break;
          }
        }
      });
    }
    default:
      throw new Error(
        `Conversion of "${element.name}" elements is not implemented yet.`
      );
  }
}

function mapActions(
  elements: XMLElement[]
): ActionFunction<any, any, any, any, any, any, any, any>[] {
  const mapped: ActionFunction<any, any, any, any, any, any, any, any>[] = [];

  for (const element of elements) {
    if (element.type === 'comment') {
      continue;
    }

    mapped.push(mapAction(element));
  }

  return mapped;
}

type HistoryAttributeValue = 'shallow' | 'deep' | undefined;

function toConfig(nodeJson: XMLElement, id: string): AnyStateNodeConfig {
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
        target: target ? `#${sanitizeStateId(target as string)}` : undefined
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

    const states: Record<string, any> = indexedRecord(stateElements, (item) =>
      sanitizeStateId(`${item.attributes!.id}`)
    );

    const initialElement = !initial
      ? nodeJson.elements.find((element) => element.name === 'initial')
      : undefined;

    if (initialElement && initialElement.elements!.length) {
      initial = initialElement.elements!.find(
        (element) => element.name === 'transition'
      )!.attributes!.target as string;
    } else if (!initial && !initialElement && stateElements.length) {
      initial = stateElements[0].attributes!.id;
    }

    const always: any[] = [];
    const on: Record<string, any> = [];

    transitionElements.forEach((value) => {
      const events = ((getAttribute(value, 'event') as string) || '').split(
        /\s+/
      );

      return events.map((eventType) => {
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
          ...(!internal && { reenter: true })
        };

        if (eventType === NULL_EVENT) {
          always.push(transitionConfig);
        } else {
          if (/^done\.state(\.|$)/.test(eventType)) {
            eventType = `xstate.${eventType}`;
          } else if (/^done\.invoke(\.|$)/.test(eventType)) {
            eventType = eventType.replace(/^done\.invoke/, 'xstate.done.actor');
          }
          let existing = on[eventType];
          if (!existing) {
            existing = [];
            on[eventType] = existing;
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

    const resolvedInitial = initial && String(initial).split(' ');

    if (resolvedInitial && resolvedInitial.length > 1) {
      throw new Error(
        `Multiple initial states are not supported ("${String(initial)}").`
      );
    }

    return {
      id: sanitizeStateId(id),
      ...(resolvedInitial
        ? {
            initial: sanitizeStateId(resolvedInitial[0])
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
      ...(always.length ? { always } : undefined),
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
        .reduce(
          (acc, element) => {
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
          },
          {} as Record<string, unknown>
        )
    : undefined;

  const machine = createMachine({
    ...toConfig(machineElement, '(machine)'),
    context
  });

  appendWildcards(machine.root);

  return machine;
}

export function toMachine(xml: string): AnyStateMachine {
  const json = xml2js(xml) as XMLElement;
  return scxmlToMachine(json);
}
