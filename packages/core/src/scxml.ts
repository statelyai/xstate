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
  ScxmlCancelJSON,
  ScxmlDonedataJSON,
  ScxmlForeachJSON,
  ScxmlRaiseJSON,
  StateNodeJSON,
  TransitionJSON,
  createMachineFromConfig
} from './createMachineFromConfig.ts';
import { parseDelayToMilliseconds } from './delay.ts';
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

  const parsedDelay = parseDelayToMilliseconds(delay);
  if (parsedDelay !== undefined) {
    return parsedDelay;
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

interface ScxmlIfBranch {
  cond?: string;
  actions: ActionJSON[];
}

function parseIfElement(element: XMLElement): ActionJSON {
  const branches: ScxmlIfBranch[] = [];
  let currentCond: string | undefined = element.attributes?.cond as string;
  let currentActions: ActionJSON[] = [];

  if (element.elements) {
    for (const child of element.elements) {
      if (child.type === 'comment') continue;
      if (child.name === 'elseif') {
        branches.push({ cond: currentCond, actions: currentActions });
        currentCond = child.attributes?.cond as string;
        currentActions = [];
      } else if (child.name === 'else') {
        branches.push({ cond: currentCond, actions: currentActions });
        currentCond = undefined; // else has no condition
        currentActions = [];
      } else {
        currentActions.push(mapAction(child));
      }
    }
  }
  // Push the last branch
  branches.push({ cond: currentCond, actions: currentActions });

  return {
    type: 'scxml.if',
    branches
  } as any;
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
      if ('sendidexpr' in element.attributes!) {
        return {
          type: 'scxml.cancel',
          sendidexpr: element.attributes.sendidexpr as string
        } as ScxmlCancelJSON;
      }
      return {
        type: '@xstate.cancel',
        id: ''
      };
    }
    case 'send': {
      const { event, eventexpr, target, targetexpr, id, delay, delayexpr } =
        element.attributes!;

      // Extract params from child elements
      const params: Array<{ name: string; expr: string }> = [];
      if (element.elements) {
        for (const child of element.elements) {
          if (child.name === 'param') {
            params.push({
              name: child.attributes!.name as string,
              expr: child.attributes!.expr as string
            });
          } else if (child.name === 'content') {
            throw new Error(
              'Conversion of <content/> inside <send/> not implemented.'
            );
          }
        }
      }

      const isInternal = target === SpecialTargets.Internal;
      const isParentTarget = target === '#_parent';
      // External events (non-internal) go to external queue via delay:0
      // This ensures internal events are processed first within a macrostep.
      // #_parent sends use undefined delay for immediate relay.
      const resolvedDelay = delay
        ? delayToMs(delay)
        : isInternal || isParentTarget
          ? undefined
          : 0;

      // Any send with a special target (except internal), params, or expressions
      // uses ScxmlRaiseJSON. Target resolution happens at runtime in executeActions.
      const hasNonInternalTarget =
        typeof target === 'string' && target.length > 0 && !isInternal;
      if (
        hasNonInternalTarget ||
        params.length ||
        eventexpr ||
        delayexpr ||
        targetexpr
      ) {
        const action: ScxmlRaiseJSON = {
          type: 'scxml.raise',
          event: event as string | undefined,
          eventexpr: eventexpr as string | undefined,
          params: params.length ? params : undefined,
          id: id as string | undefined,
          delay: resolvedDelay,
          delayexpr: delayexpr as string | undefined,
          target: target as string | undefined,
          targetexpr: targetexpr as string | undefined
        };
        return action;
      }

      // Simple send (no special target, no expressions)
      const action: RaiseJSON = {
        type: '@xstate.raise',
        event: { type: (event as string) || 'unknown' },
        id: id as string | undefined,
        delay: resolvedDelay
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
      return parseIfElement(element);
    }
    case 'foreach': {
      const array = element.attributes!.array as string;
      const item = element.attributes!.item as string;
      const index = element.attributes?.index as string | undefined;
      const actions = element.elements ? mapActions(element.elements) : [];
      const foreach: ScxmlForeachJSON = {
        type: 'scxml.foreach',
        array,
        item,
        index,
        actions
      };
      return foreach;
    }
    case 'script': {
      // Get the script text content
      const textElement = element.elements?.find((el) => el.type === 'text');
      const code = (textElement?.text as string) || '';
      return { type: 'scxml.script', code: code.trim() };
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
      target: target ? `#${sanitizeStateId(target as string)}` : undefined
    };
  }

  if (!nodeJson.elements) {
    return {
      id: sanitizeStateId(id),
      ...(nodeJson.name === 'final' ? { type: 'final' } : undefined)
    };
  }

  // Parse <donedata> for final states
  let donedataConfig: ScxmlDonedataJSON | undefined;
  if (nodeJson.name === 'final') {
    const donedataElement = nodeJson.elements.find(
      (el) => el.name === 'donedata'
    );
    if (donedataElement?.elements) {
      const params: Array<{ name: string; expr: string }> = [];
      let contentExpr: string | undefined;
      let contentText: string | undefined;
      for (const child of donedataElement.elements) {
        if (child.name === 'param') {
          params.push({
            name: child.attributes!.name as string,
            expr: child.attributes!.expr as string
          });
        } else if (child.name === 'content') {
          if (child.attributes?.expr) {
            contentExpr = child.attributes.expr as string;
          } else if (child.elements) {
            const textEl = child.elements.find(
              (el) => el.type === 'text' || el.type === 'cdata'
            );
            contentText = textEl
              ? String(textEl.text ?? textEl.cdata ?? '').trim()
              : '';
          }
        }
      }
      donedataConfig = { params, contentExpr, contentText };
    }
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

      // Only set reenter:true for external transitions WITH a target
      // Targetless transitions should not reenter (they just execute actions)
      const hasTarget = targets !== undefined;
      const transitionConfig: TransitionJSON = {
        target: getTargets(targets),
        ...(value.elements?.length
          ? { actions: mapActions(value.elements) }
          : undefined),
        ...(guard ? { guard } : undefined),
        ...(hasTarget && !internal && { reenter: true })
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

  // Build entry/exit actions. Per SCXML, each <onentry>/<onexit> block is a
  // separate executable-content block — errors in one block must not stop
  // execution of subsequent blocks. Wrap each block in scxml.block so the
  // runtime executes them with isolated error state.
  const entry = onEntryElements.length
    ? onEntryElements.map((onEntryElement) => ({
        type: 'scxml.block' as const,
        actions: mapActions(onEntryElement.elements || [])
      }))
    : undefined;

  const exit = onExitElements.length
    ? onExitElements.map((onExitElement) => ({
        type: 'scxml.block' as const,
        actions: mapActions(onExitElement.elements || [])
      }))
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

    // Convert nested SCXML content to a machine JSON
    const nestedScxml = content?.elements?.find(
      (el) => el.name === 'scxml'
    ) as XMLElement;

    let _nestedMachineJSON: MachineJSON | undefined;
    if (nestedScxml) {
      // Create a wrapper that looks like xml2js output: { elements: [scxmlElement] }
      const wrapper: XMLElement = { elements: [nestedScxml] };
      _nestedMachineJSON = scxmlToMachineJSON(wrapper);
    }

    return {
      ...(element.attributes!.id && { id: element.attributes!.id as string }),
      src: 'scxml.nested',
      _nestedMachineJSON
    } as InvokeJSON & { _nestedMachineJSON?: MachineJSON };
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
    ...(donedataConfig ? { _scxmlDonedata: donedataConfig } : undefined),
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

            if (expr === undefined) {
              // Check for text content inside the <data> element
              const textEl = element.elements?.find(
                (el) => el.type === 'text' || el.type === 'cdata'
              );
              const textContent = textEl
                ? String(textEl.text ?? textEl.cdata ?? '').trim()
                : '';
              if (textContent) {
                acc[id!] = eval(`(${textContent})`);
              } else {
                acc[id!] = undefined;
              }
            } else if (expr === '_sessionid') {
              acc[id!] = 'session_scxml';
            } else if (expr === '_name') {
              acc[id!] =
                (machineElement.attributes?.name as string) || '(machine)';
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
