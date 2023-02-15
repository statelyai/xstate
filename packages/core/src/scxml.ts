import { xml2js, Element as XMLElement } from 'xml-js';
import {
  EventObject,
  ActionObject,
  SCXMLEventMeta,
  SendExpr,
  DelayExpr,
  ChooseCondition
} from './types';
import { AnyStateMachine, Machine } from './index';
import { mapValues, isString } from './utils';
import * as actions from './actions';

function getAttribute(
  element: XMLElement,
  attribute: string
): string | number | undefined {
  return element.attributes ? element.attributes[attribute] : undefined;
}

function indexedRecord<T extends {}>(
  items: T[],
  identifier: string | ((item: T) => string)
): Record<string, T> {
  const record: Record<string, T> = {};

  const identifierFn = isString(identifier)
    ? (item) => item[identifier]
    : identifier;

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
  _ev: TEvent,
  meta: SCXMLEventMeta<TEvent>,
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
  return fn(context, meta._event);
};

function createCond<
  TContext extends object,
  TEvent extends EventObject = EventObject
>(cond: string) {
  return (context: TContext, _event: TEvent, meta) => {
    return evaluateExecutableContent(context, _event, meta, `return ${cond};`);
  };
}

function mapAction<
  TContext extends object,
  TEvent extends EventObject = EventObject
>(element: XMLElement): ActionObject<TContext, TEvent> {
  switch (element.name) {
    case 'raise': {
      return actions.raise<TContext, TEvent, TEvent>(
        element.attributes!.event! as string
      );
    }
    case 'assign': {
      return actions.assign<TContext, TEvent>((context, e, meta) => {
        const fnBody = `
            return {'${element.attributes!.location}': ${
          element.attributes!.expr
        }};
          `;

        return evaluateExecutableContent(context, e, meta, fnBody);
      });
    }
    case 'send': {
      const { event, eventexpr, target } = element.attributes!;

      let convertedEvent: TEvent['type'] | SendExpr<TContext, TEvent>;
      let convertedDelay: number | DelayExpr<TContext, TEvent> | undefined;

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
        convertedEvent = event as TEvent['type'];
      } else {
        convertedEvent = (context, _ev, meta) => {
          const fnBody = `
              return { type: ${event ? `"${event}"` : eventexpr}, ${
            params ? params : ''
          } }
            `;

          return evaluateExecutableContent(context, _ev, meta, fnBody);
        };
      }

      if ('delay' in element.attributes!) {
        convertedDelay = delayToMs(element.attributes!.delay);
      } else if (element.attributes!.delayexpr) {
        convertedDelay = (context, _ev, meta) => {
          const fnBody = `
              return (${delayToMs})(${element.attributes!.delayexpr});
            `;

          return evaluateExecutableContent(context, _ev, meta, fnBody);
        };
      }

      return actions.send<TContext, TEvent>(convertedEvent, {
        delay: convertedDelay,
        to: target as string | undefined
      });
    }
    case 'log': {
      const label = element.attributes!.label;

      return actions.log<TContext, TEvent>(
        (context, e, meta) => {
          const fnBody = `
              return ${element.attributes!.expr};
            `;

          return evaluateExecutableContent(context, e, meta, fnBody);
        },
        label !== undefined ? String(label) : undefined
      );
    }
    case 'if': {
      const conds: ChooseCondition<TContext, TEvent>[] = [];

      let current: ChooseCondition<TContext, TEvent> = {
        cond: createCond(element.attributes!.cond as string),
        actions: []
      };

      for (const el of element.elements!) {
        if (el.type === 'comment') {
          continue;
        }

        switch (el.name) {
          case 'elseif':
            conds.push(current);
            current = {
              cond: createCond(el.attributes!.cond as string),
              actions: []
            };
            break;
          case 'else':
            conds.push(current);
            current = { actions: [] };
            break;
          default:
            (current.actions as any[]).push(mapAction<TContext, TEvent>(el));
            break;
        }
      }

      conds.push(current);
      return actions.choose(conds);
    }
    default:
      throw new Error(
        `Conversion of "${element.name}" elements is not implemented yet.`
      );
  }
}

function mapActions<
  TContext extends object,
  TEvent extends EventObject = EventObject
>(elements: XMLElement[]): Array<ActionObject<TContext, TEvent>> {
  const mapped: Array<ActionObject<TContext, TEvent>> = [];

  for (const element of elements) {
    if (element.type === 'comment') {
      continue;
    }

    mapped.push(mapAction(element));
  }

  return mapped;
}

function toConfig(
  nodeJson: XMLElement,
  id: string,
  options: ScxmlToMachineOptions
) {
  const parallel = nodeJson.name === 'parallel';
  let initial = parallel ? undefined : nodeJson.attributes!.initial;
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
        (element) => element.name === 'transition'
      );

      const target = getAttribute(transitionElement, 'target');
      const history = getAttribute(nodeJson, 'type') || 'shallow';

      return {
        id,
        history,
        target: target ? `#${target}` : undefined
      };
    }
    case 'final': {
      return {
        ...nodeJson.attributes,
        type: 'final'
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

    const onEntryElement = nodeJson.elements.find(
      (element) => element.name === 'onentry'
    );

    const onExitElement = nodeJson.elements.find(
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
    } else if (!initialElement && stateElements.length) {
      initial = stateElements[0].attributes!.id;
    }

    const on = transitionElements.map((value) => {
      const event = getAttribute(value, 'event') || '';
      const targets = getAttribute(value, 'target');
      const internal = getAttribute(value, 'type') === 'internal';

      return {
        event,
        target: getTargets(targets),
        ...(value.elements ? executableContent(value.elements) : undefined),
        ...(value.attributes && value.attributes.cond
          ? {
              cond: createCond(value.attributes!.cond as string)
            }
          : undefined),
        internal
      };
    });

    const onEntry = onEntryElement
      ? mapActions(onEntryElement.elements!)
      : undefined;

    const onExit = onExitElement
      ? mapActions(onExitElement.elements!)
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

      return scxmlToMachine(content, options);
    });

    return {
      id,
      ...(initial ? { initial } : undefined),
      ...(parallel ? { type: 'parallel' } : undefined),
      ...(stateElements.length
        ? {
            states: mapValues(states, (state, key) =>
              toConfig(state, key, options)
            )
          }
        : undefined),
      ...(transitionElements.length ? { on } : undefined),
      ...(onEntry ? { onEntry } : undefined),
      ...(onExit ? { onExit } : undefined),
      ...(invoke.length ? { invoke } : undefined)
    };
  }

  return { id };
}

export interface ScxmlToMachineOptions {
  delimiter?: string;
}

function scxmlToMachine(
  scxmlJson: XMLElement,
  options: ScxmlToMachineOptions
): AnyStateMachine {
  const machineElement = scxmlJson.elements!.find(
    (element) => element.name === 'scxml'
  ) as XMLElement;

  const dataModelEl = machineElement.elements!.filter(
    (element) => element.name === 'datamodel'
  )[0];

  const extState = dataModelEl
    ? dataModelEl
        .elements!.filter((element) => element.name === 'data')
        .reduce((acc, element) => {
          if (element.attributes!.src) {
            throw new Error(
              "Conversion of `src` attribute on datamodel's <data> elements is not supported."
            );
          }
          acc[element.attributes!.id!] = element.attributes!.expr
            ? // tslint:disable-next-line:no-eval
              eval(`(${element.attributes!.expr})`)
            : undefined;
          return acc;
        }, {})
    : undefined;

  return Machine({
    ...toConfig(machineElement, '(machine)', options),
    context: extState,
    delimiter: options.delimiter
  });
}

export function toMachine(
  xml: string,
  options: ScxmlToMachineOptions
): AnyStateMachine {
  const json = xml2js(xml) as XMLElement;
  return scxmlToMachine(json, options);
}
