import { Element as XMLElement, xml2js } from 'xml-js';
import { NULL_EVENT } from './constants.ts';
import {
  ActionJSON,
  CancelJSON,
  GuardJSON,
  InvokeJSON,
  LogJSON,
  MachineJSON,
  RaiseJSON,
  StateNodeJSON,
  TransitionJSON,
  createMachineFromConfig
} from './createMachineFromConfig.ts';
import { AnyStateMachine, SpecialTargets } from './types.ts';

export function sanitizeStateId(id: string) {
  return id.replace(/\./g, '$');
}

function getAttribute(
  element: XMLElement,
  attribute: string
): string | number | undefined {
  return element.attributes ? element.attributes[attribute] : undefined;
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
    const secondsPart = secondsMatch[1]
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

function getTargets(targetAttr?: string | number): string[] | undefined {
  return targetAttr
    ? `${targetAttr}`
        .split(/\s+/)
        .map((target) => `#${sanitizeStateId(target)}`)
    : undefined;
}

function mapAction(element: XMLElement): ActionJSON {
  switch (element.name) {
    case 'raise': {
      const action: RaiseJSON = {
        type: '@xstate.raise',
        event: { type: element.attributes!.event as string }
      };
      return action;
    }
    case 'assign': {
      // SCXML assign uses location and expr attributes
      const location = element.attributes!.location as string;
      const expr = element.attributes!.expr as string;
      return {
        type: 'scxml.assign' as const,
        location,
        expr
      };
    }
    case 'cancel': {
      if ('sendid' in element.attributes!) {
        const action: CancelJSON = {
          type: '@xstate.cancel',
          id: element.attributes.sendid as string
        };
        return action;
      }
      // sendidexpr not fully supported
      return {
        type: '@xstate.cancel',
        id: ''
      };
    }
    case 'send': {
      const { event, target, id, delay } = element.attributes!;

      // If target is internal, treat as raise
      if (target === SpecialTargets.Internal) {
        const action: RaiseJSON = {
          type: '@xstate.raise',
          event: { type: event as string },
          id: id as string | undefined,
          delay: delay ? delayToMs(delay) : undefined
        };
        return action;
      }

      // For external sends, we still use raise for now (self-targeting)
      const action: RaiseJSON = {
        type: '@xstate.raise',
        event: { type: (event as string) || 'unknown' },
        id: id as string | undefined,
        delay: delay ? delayToMs(delay) : undefined
      };
      return action;
    }
    case 'log': {
      const label = element.attributes!.label;
      const expr = element.attributes!.expr;
      const action: LogJSON = {
        type: '@xstate.log',
        args:
          label !== undefined ? [String(label), String(expr)] : [String(expr)]
      };
      return action;
    }
    case 'if': {
      // if/elseif/else - we'll flatten this into a single custom action for now
      // The full implementation would require runtime conditional logic
      return { type: 'scxml.if', params: { element } };
    }
    default:
      throw new Error(
        `Conversion of "${element.name}" elements is not implemented yet.`
      );
  }
}

function mapActions(elements: XMLElement[]): ActionJSON[] {
  const mapped: ActionJSON[] = [];

  for (const element of elements) {
    if (element.type === 'comment') {
      continue;
    }

    mapped.push(mapAction(element));
  }

  return mapped;
}

function createGuard(cond: string): GuardJSON {
  // Handle In() predicate
  if (cond.startsWith('In')) {
    const inMatch = cond.trim().match(/^In\('(.*)'\)/);
    if (inMatch) {
      return {
        type: 'xstate.stateIn',
        params: { stateId: `#${sanitizeStateId(inMatch[1])}` }
      };
    }
  }

  // Handle !In() predicate
  if (cond.startsWith('!In')) {
    const notInMatch = cond.trim().match(/^!In\('(.*)'\)/);
    if (notInMatch) {
      return {
        type: 'xstate.not',
        params: {
          guard: {
            type: 'xstate.stateIn',
            params: { stateId: `#${sanitizeStateId(notInMatch[1])}` }
          }
        }
      };
    }
  }

  // For other conditions, store the expression for runtime evaluation
  return {
    type: 'scxml.cond',
    params: { expr: cond }
  };
}

type HistoryAttributeValue = 'shallow' | 'deep' | undefined;

function toStateNodeJSON(
  nodeJson: XMLElement,
  id: string,
  parentId?: string
): StateNodeJSON {
  const parallel = nodeJson.name === 'parallel';
  let initial = parallel ? undefined : (nodeJson.attributes?.initial as string);
  const { elements } = nodeJson;

  const stateId = parentId ? `${parentId}.${id}` : id;

  // Handle history states
  if (nodeJson.name === 'history') {
    const history =
      (getAttribute(nodeJson, 'type') as HistoryAttributeValue) || 'shallow';
    if (!elements) {
      return {
        id: sanitizeStateId(id),
        type: 'history',
        history
      };
    }

    const [transitionElement] = elements.filter(
      (element) => element.name === 'transition'
    );

    const target = getAttribute(transitionElement, 'target');

    return {
      id: sanitizeStateId(id),
      type: 'history',
      history,
      target: target
        ? `
      #${sanitizeStateId(target as string)}`
        : undefined
    };
  }

  if (!nodeJson.elements) {
    return {
      id: sanitizeStateId(id),
      ...(nodeJson.name === 'final' ? { type: 'final' } : undefined)
    };
  }

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

  // Build states object
  const states: Record<string, StateNodeJSON> = {};
  for (const stateElement of stateElements) {
    const childId = sanitizeStateId(`${stateElement.attributes!.id}`);
    states[childId] = toStateNodeJSON(stateElement, childId, stateId);
  }

  // Determine initial state
  const initialElement = !initial
    ? nodeJson.elements.find((element) => element.name === 'initial')
    : undefined;

  if (initialElement && initialElement.elements?.length) {
    initial = initialElement.elements.find(
      (element) => element.name === 'transition'
    )!.attributes!.target as string;
  } else if (!initial && !initialElement && stateElements.length) {
    initial = stateElements[0].attributes!.id as string;
  }

  // Build transitions
  const always: TransitionJSON[] = [];
  const on: Record<string, TransitionJSON | TransitionJSON[]> = {};

  transitionElements.forEach((value) => {
    const events = ((getAttribute(value, 'event') as string) || '').split(
      /\s+/
    );

    events.forEach((eventType) => {
      const targets = getAttribute(value, 'target');
      const internal = getAttribute(value, 'type') === 'internal';

      let guard: GuardJSON | undefined;
      if (value.attributes?.cond) {
        guard = createGuard(value.attributes.cond as string);
      }

      const transitionConfig: TransitionJSON = {
        target: getTargets(targets),
        ...(value.elements?.length
          ? { actions: mapActions(value.elements) }
          : undefined),
        ...(guard ? { guard } : undefined),
        ...(!internal && { reenter: true })
      };

      if (eventType === NULL_EVENT || eventType === '') {
        always.push(transitionConfig);
      } else {
        let normalizedEventType = eventType;
        if (/^done\.state(\.|$)/.test(eventType)) {
          normalizedEventType = `xstate.${eventType}`;
        } else if (/^done\.invoke(\.|$)/.test(eventType)) {
          normalizedEventType = eventType.replace(
            /^done\.invoke/,
            'xstate.done.actor'
          );
        }

        // Append wildcard for SCXML prefix matching
        if (
          normalizedEventType !== '*' &&
          !normalizedEventType.endsWith('.*')
        ) {
          normalizedEventType = `${normalizedEventType}.*`;
        }

        const existing = on[normalizedEventType];
        if (!existing) {
          on[normalizedEventType] = transitionConfig;
        } else if (Array.isArray(existing)) {
          existing.push(transitionConfig);
        } else {
          on[normalizedEventType] = [existing, transitionConfig];
        }
      }
    });
  });

  // Build entry/exit actions
  const entry = onEntryElements.length
    ? onEntryElements.flatMap((onEntryElement) =>
        mapActions(onEntryElement.elements || [])
      )
    : undefined;

  const exit = onExitElements.length
    ? onExitElements.flatMap((onExitElement) =>
        mapActions(onExitElement.elements || [])
      )
    : undefined;

  // Build invokes
  const invoke: InvokeJSON[] = invokeElements.map((element) => {
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

    // For nested SCXML, we need to convert it to a machine
    // For now, we'll store a reference
    return {
      ...(element.attributes!.id && { id: element.attributes!.id as string }),
      src: 'scxml.nested', // Placeholder - would need to convert nested SCXML
      _scxmlContent: content // Store for later processing
    } as InvokeJSON;
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
      ? { initial: sanitizeStateId(resolvedInitial[0]) }
      : undefined),
    ...(parallel ? { type: 'parallel' } : undefined),
    ...(nodeJson.name === 'final' ? { type: 'final' } : undefined),
    ...(Object.keys(states).length ? { states } : undefined),
    ...(Object.keys(on).length ? { on } : undefined),
    ...(always.length ? { always } : undefined),
    ...(entry?.length ? { entry } : undefined),
    ...(exit?.length ? { exit } : undefined),
    ...(invoke.length ? { invoke } : undefined)
  };
}

function scxmlToMachineJSON(scxmlJson: XMLElement): MachineJSON {
  const machineElement = scxmlJson.elements!.find(
    (element) => element.name === 'scxml'
  ) as XMLElement;

  const dataModelEl = machineElement.elements?.filter(
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

            if (expr === '_sessionid' || expr === undefined) {
              acc[id!] = undefined;
            } else {
              acc[id!] = eval(`(${expr})`);
            }

            return acc;
          },
          {} as Record<string, unknown>
        )
    : undefined;

  const machineId = (machineElement.attributes?.name as string) || '(machine)';
  const stateNodeJSON = toStateNodeJSON(machineElement, machineId);

  return {
    ...stateNodeJSON,
    context
  };
}

/**
 * Converts an SCXML string to a JSON representation that can be used with
 * createMachineFromConfig.
 */
export function toMachineJSON(xml: string): MachineJSON {
  const json = xml2js(xml) as XMLElement;
  return scxmlToMachineJSON(json);
}

/** Converts an SCXML string to an XState machine. */
export function toMachine(xml: string): AnyStateMachine {
  const machineJSON = toMachineJSON(xml);
  return createMachineFromConfig(machineJSON);
}
