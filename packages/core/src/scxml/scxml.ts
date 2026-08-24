/**
 * SCXML machine creation and conversion utilities for the `xstate/scxml`
 * entry point. Only createMachineFromSCXML and SCXMLConversionOptions are
 * public; the compiler representation remains internal.
 */
import { SaxesParser } from 'saxes';
import {
  ActionJSON,
  CancelJSON,
  GuardJSON,
  InvokeJSON,
  ScxmlIR,
  RaiseJSON,
  ScxmlCancelJSON,
  ScxmlContentJSON,
  ScxmlDataJSON,
  ScxmlDonedataJSON,
  ScxmlForeachJSON,
  ScxmlLogJSON,
  ScxmlRaiseJSON,
  ScxmlXmlJSON,
  StateNodeJSON,
  TransitionJSON,
  createMachineFromSCXMLConfig
} from './runtime.ts';
import { parseDelayToMilliseconds } from '../delay.ts';
import { AnyStateMachine, SpecialTargets } from '../types.ts';

interface XMLElement {
  type?: 'element' | 'text' | 'cdata' | 'comment';
  name?: string;
  attributes?: Record<string, string>;
  elements?: XMLElement[];
  text?: string;
  cdata?: string;
}

function parseXml(xml: string): XMLElement {
  const root: XMLElement = { elements: [] };
  const stack = [root];
  const append = (element: XMLElement) =>
    stack[stack.length - 1].elements!.push(element);
  const parser = new SaxesParser();

  parser.on('opentag', (tag) => {
    const attributes = { ...tag.attributes };
    const element: XMLElement = {
      type: 'element',
      name: tag.name,
      ...(Object.keys(attributes).length ? { attributes } : undefined),
      elements: []
    };
    append(element);
    stack.push(element);
  });
  parser.on('closetag', () => {
    const element = stack.pop()!;
    if (!element.elements?.length) {
      delete element.elements;
    }
  });
  parser.on('text', (text) => {
    if (text.trim()) append({ type: 'text', text });
  });
  parser.on('cdata', (cdata) => append({ type: 'cdata', cdata }));
  parser.on('comment', (text) => append({ type: 'comment', text }));
  parser.write(xml).close();
  return root;
}

export function sanitizeStateId(id: string) {
  return id.replace(/\./g, '$');
}

export interface SCXMLConversionOptions {
  resolveResource?: (src: string, kind: 'data' | 'script' | 'invoke') => string;
}

function normalizeElementNames(element: XMLElement): XMLElement {
  if (element.name?.includes(':')) {
    element.name = element.name.slice(element.name.lastIndexOf(':') + 1);
  }
  for (const child of element.elements ?? []) {
    normalizeElementNames(child);
  }
  return element;
}

function resolveResource(
  options: SCXMLConversionOptions,
  src: string,
  kind: 'data' | 'script' | 'invoke'
): string {
  if (!options.resolveResource) {
    throw new Error(`No SCXML resource resolver provided for ${kind}: ${src}`);
  }
  return options.resolveResource(src, kind);
}

function getAttribute(
  element: XMLElement,
  attribute: string
): string | number | undefined {
  return element.attributes ? element.attributes[attribute] : undefined;
}

function toScxmlXmlJSON(element: XMLElement): ScxmlXmlJSON {
  return {
    name: element.name!,
    ...(element.attributes
      ? {
          attributes: Object.fromEntries(
            Object.entries(element.attributes).map(([key, value]) => [
              key,
              String(value)
            ])
          )
        }
      : undefined),
    ...((element.elements ?? []).some((child) => child.name)
      ? {
          children: (element.elements ?? [])
            .filter((child) => child.name)
            .map(toScxmlXmlJSON)
        }
      : undefined)
  };
}

function getContentDescriptor(element: XMLElement): ScxmlContentJSON {
  if (element.attributes?.expr !== undefined) {
    return { expr: String(element.attributes.expr) };
  }
  const xml = element.elements?.find((child) => child.name);
  if (xml) {
    return { xml: toScxmlXmlJSON(xml) };
  }
  return {
    text: (element.elements ?? [])
      .filter((child) => child.type === 'text' || child.type === 'cdata')
      .map((child) => String(child.text ?? child.cdata ?? ''))
      .join('')
  };
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

function normalizeScxmlEventType(eventType: string): string {
  return /^error(\.|$)/.test(eventType) ? `xstate.${eventType}` : eventType;
}

interface ScxmlIfBranch {
  cond?: string;
  actions: ActionJSON[];
}

function parseIfElement(
  element: XMLElement,
  options: SCXMLConversionOptions
): ActionJSON {
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
        currentActions.push(mapAction(child, options));
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

function mapAction(
  element: XMLElement,
  options: SCXMLConversionOptions
): ActionJSON {
  switch (element.name) {
    case 'raise': {
      const action: RaiseJSON = {
        type: '@xstate.raise',
        event: {
          type: normalizeScxmlEventType(element.attributes!.event as string)
        }
      };
      return action;
    }
    case 'assign': {
      // SCXML assign uses location and expr attributes
      const location = element.attributes!.location as string;
      const expr =
        element.attributes?.expr !== undefined
          ? String(element.attributes.expr)
          : JSON.stringify(
              toScxmlXmlJSON(element.elements!.find((child) => child.name)!)
            );
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
      const {
        event,
        eventexpr,
        target,
        targetexpr,
        id,
        idlocation,
        delay,
        delayexpr,
        namelist,
        type
      } = element.attributes!;

      // Extract params from child elements
      const params: Array<{
        name: string;
        expr?: string;
        location?: string;
      }> = [];
      let content: ScxmlContentJSON | undefined;
      if (element.elements) {
        for (const child of element.elements) {
          if (child.name === 'param') {
            params.push({
              name: child.attributes!.name as string,
              ...(child.attributes!.expr !== undefined
                ? { expr: child.attributes!.expr as string }
                : { location: child.attributes!.location as string })
            });
          } else if (child.name === 'content') {
            content = getContentDescriptor(child);
          }
        }
      }

      const isInternal = target === String(SpecialTargets.Internal);
      const resolvedDelay = delay ? delayToMs(delay) : undefined;

      // Any send with a special target (except internal), params, or expressions
      // uses ScxmlRaiseJSON. Target resolution happens at runtime in executeActions.
      const hasNonInternalTarget =
        typeof target === 'string' && target.length > 0 && !isInternal;
      if (
        hasNonInternalTarget ||
        params.length ||
        eventexpr ||
        delayexpr ||
        targetexpr ||
        namelist ||
        content ||
        idlocation ||
        type
      ) {
        const action: ScxmlRaiseJSON = {
          type: 'scxml.raise',
          event:
            typeof event === 'string'
              ? normalizeScxmlEventType(event)
              : undefined,
          eventexpr: eventexpr as string | undefined,
          params: params.length ? params : undefined,
          namelist:
            typeof namelist === 'string'
              ? namelist.trim().split(/\s+/)
              : undefined,
          id: id as string | undefined,
          idlocation: idlocation as string | undefined,
          delay: resolvedDelay,
          delayexpr: delayexpr as string | undefined,
          target: target as string | undefined,
          targetexpr: targetexpr as string | undefined,
          processorType: type as string | undefined,
          content
        };
        return action;
      }

      // Simple send (no special target, no expressions)
      const action: ScxmlRaiseJSON = {
        type: 'scxml.raise',
        event: event as string | undefined,
        eventexpr: undefined,
        params: undefined,
        namelist: undefined,
        id: id as string | undefined,
        idlocation: idlocation as string | undefined,
        delay: resolvedDelay,
        target: target as string | undefined,
        targetexpr: undefined,
        processorType: type as string | undefined,
        content
      };
      return action;
    }
    case 'log': {
      const label = element.attributes!.label;
      const expr = element.attributes!.expr;
      const action: ScxmlLogJSON = {
        type: 'scxml.log',
        ...(label !== undefined ? { label: String(label) } : undefined),
        ...(expr !== undefined ? { expr: String(expr) } : undefined)
      };
      return action;
    }
    case 'if': {
      return parseIfElement(element, options);
    }
    case 'foreach': {
      const array = element.attributes!.array as string;
      const item = element.attributes!.item as string;
      const index = element.attributes?.index as string | undefined;
      const actions = element.elements
        ? mapActions(element.elements, options)
        : [];
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
      if (element.attributes?.src) {
        return {
          type: 'scxml.script',
          code: resolveResource(
            options,
            String(element.attributes.src),
            'script'
          )
        };
      }
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

function mapActions(
  elements: XMLElement[],
  options: SCXMLConversionOptions
): ActionJSON[] {
  const mapped: ActionJSON[] = [];

  for (const element of elements) {
    if (element.type === 'comment') {
      continue;
    }

    mapped.push(mapAction(element, options));
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

function getDataDescriptors(
  element: XMLElement,
  options: SCXMLConversionOptions
): ScxmlDataJSON[] {
  return (element.elements ?? [])
    .filter((child) => child.name === 'datamodel')
    .flatMap((datamodel) =>
      (datamodel.elements ?? [])
        .filter((child) => child.name === 'data')
        .map((data) => {
          const src = data.attributes?.src;
          const resolvedSource =
            src !== undefined
              ? resolveResource(options, String(src), 'data')
              : undefined;
          const text = (data.elements ?? [])
            .filter((child) => child.type === 'text' || child.type === 'cdata')
            .map((child) => String(child.text ?? child.cdata ?? ''))
            .join('')
            .trim();
          const xml = data.elements?.find((child) => child.name);
          let resourceXml: XMLElement | undefined;
          if (resolvedSource !== undefined) {
            try {
              resourceXml = normalizeElementNames(
                parseXml(resolvedSource)
              ).elements?.find((child) => child.name);
            } catch {
              resourceXml = undefined;
            }
          }
          return {
            id: String(data.attributes!.id),
            ...(data.attributes?.expr !== undefined
              ? { expr: String(data.attributes.expr) }
              : undefined),
            ...(resolvedSource !== undefined && !resourceXml
              ? { content: resolvedSource.trim() }
              : text
                ? { content: text }
                : undefined),
            ...(resourceXml
              ? { xml: toScxmlXmlJSON(resourceXml) }
              : xml
                ? { xml: toScxmlXmlJSON(xml) }
                : undefined)
          };
        })
    );
}

function collectDataDescriptors(
  element: XMLElement,
  options: SCXMLConversionOptions
): ScxmlDataJSON[] {
  return [
    ...getDataDescriptors(element, options),
    ...(element.elements ?? [])
      .filter((child) =>
        ['state', 'parallel', 'final'].includes(child.name ?? '')
      )
      .flatMap((child) => collectDataDescriptors(child, options))
  ];
}

function toStateNodeJSON(
  nodeJson: XMLElement,
  id: string,
  parentId?: string,
  binding: 'early' | 'late' = 'early',
  options: SCXMLConversionOptions = {}
): StateNodeJSON {
  const parallel = nodeJson.name === 'parallel';
  let initial = parallel ? undefined : (nodeJson.attributes?.initial as string);
  let initialActions: ActionJSON[] | undefined;
  const hasInitialAttribute = initial !== undefined;
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
      target: target ? `#${sanitizeStateId(target as string)}` : undefined,
      ...(transitionElement.elements?.length
        ? {
            _scxmlHistoryActions: mapActions(
              transitionElement.elements,
              options
            )
          }
        : undefined)
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
            expr: String(
              child.attributes?.expr ?? child.attributes?.location ?? ''
            ).trim()
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
  stateElements.forEach((element, index) => {
    if (element.attributes?.id === undefined) {
      element.attributes = {
        ...element.attributes,
        id: `${id}.anonymous.${index}`
      };
    }
  });

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
  const directScripts = nodeJson.elements
    .filter((element) => element.name === 'script')
    .map((element) => ({
      ...mapAction(element, options),
      global: true
    }));

  // Build states object
  const states: Record<string, StateNodeJSON> = {};
  for (const stateElement of stateElements) {
    const childId = sanitizeStateId(`${stateElement.attributes!.id}`);
    states[childId] = toStateNodeJSON(
      stateElement,
      childId,
      stateId,
      binding,
      options
    );
  }

  // Determine initial state
  const initialElement = !initial
    ? nodeJson.elements.find((element) => element.name === 'initial')
    : undefined;

  if (initialElement && initialElement.elements?.length) {
    const initialTransition = initialElement.elements.find(
      (element) => element.name === 'transition'
    )!;
    initial = initialTransition.attributes!.target as string;
    initialActions = initialTransition.elements?.length
      ? mapActions(initialTransition.elements, options)
      : undefined;
  } else if (!initial && !initialElement && stateElements.length) {
    initial = stateElements[0].attributes!.id as string;
  }

  // Build transitions
  const always: TransitionJSON[] = [];
  const on: Record<string, TransitionJSON | TransitionJSON[]> = {};

  transitionElements.forEach((value) => {
    const eventTypes = ((getAttribute(value, 'event') as string) || '')
      .trim()
      .split(/\s+/);
    const targets = getAttribute(value, 'target');
    const internal = getAttribute(value, 'type') === 'internal';
    const hasTarget = targets !== undefined;
    const eventDescriptors = eventTypes.filter(Boolean).map((eventType) => {
      if (/^(error|done\.state)(\.|$)/.test(eventType)) {
        return `xstate.${eventType}`;
      }
      if (/^done\.invoke(\.|$)/.test(eventType)) {
        return eventType.replace(/^done\.invoke/, 'xstate.done.actor');
      }
      return eventType;
    });
    const transitionConfig: TransitionJSON = {
      target: getTargets(targets),
      _scxml: {
        ...(hasTarget && { type: internal ? 'internal' : 'external' }),
        ...(eventDescriptors.length && { eventDescriptors })
      },
      ...(value.elements?.length
        ? { actions: mapActions(value.elements, options) }
        : undefined),
      ...(value.attributes?.cond
        ? { guard: createGuard(value.attributes.cond as string) }
        : undefined),
      ...(hasTarget && !internal && { reenter: true })
    };

    if (!eventDescriptors.length) {
      always.push(transitionConfig);
      return;
    }

    const existing = on['*'];
    if (!existing) {
      on['*'] = transitionConfig;
    } else if (Array.isArray(existing)) {
      existing.push(transitionConfig);
    } else {
      on['*'] = [existing, transitionConfig];
    }
  });

  // Build entry/exit actions. Per SCXML, each <onentry>/<onexit> block is a
  // separate executable-content block — errors in one block must not stop
  // execution of subsequent blocks. Wrap each block in scxml.block so the
  // runtime executes them with isolated error state.
  const entry: ActionJSON[] = [
    ...directScripts,
    ...onEntryElements.map((onEntryElement) => ({
      type: 'scxml.block' as const,
      actions: mapActions(onEntryElement.elements || [], options)
    }))
  ];

  const exit = onExitElements.length
    ? onExitElements.map((onExitElement) => ({
        type: 'scxml.block' as const,
        actions: mapActions(onExitElement.elements || [], options)
      }))
    : undefined;

  // Build invokes
  const invoke: InvokeJSON[] = invokeElements.map((element, invokeIndex) => {
    const invokeType = element.attributes?.type as string | undefined;
    if (
      invokeType !== undefined &&
      ![
        'scxml',
        'http://www.w3.org/TR/scxml',
        'http://www.w3.org/TR/scxml/'
      ].includes(invokeType)
    ) {
      throw new Error(
        `Currently only converting invoke elements of type SCXML is supported (received ${String(invokeType)}).`
      );
    }

    const content = element.elements?.find((el) => el.name === 'content');

    // Convert nested SCXML content to a machine JSON
    const nestedScxml = content?.elements?.find((el) => el.name === 'scxml');

    const findEntryAssignment = (location: string) =>
      onEntryElements
        .flatMap((onEntry) => onEntry.elements ?? [])
        .find(
          (child) =>
            child.name === 'assign' && child.attributes?.location === location
        );

    let _nestedScxmlIR: ScxmlIR | undefined;
    if (nestedScxml) {
      // Create a wrapper that looks like parser output: { elements: [scxmlElement] }
      const wrapper: XMLElement = { elements: [nestedScxml] };
      _nestedScxmlIR = compileScxmlElement(wrapper, options);
    } else if (element.attributes?.src) {
      const source = resolveResource(
        options,
        String(element.attributes.src),
        'invoke'
      );
      _nestedScxmlIR = compileScxmlElement(
        normalizeElementNames(parseXml(source)),
        options
      );
    } else if (element.attributes?.srcexpr) {
      const assignment = findEntryAssignment(
        String(element.attributes.srcexpr)
      );
      const assignedSource = String(assignment?.attributes?.expr ?? '').match(
        /^(['"])(.*)\1$/s
      )?.[2];
      if (assignedSource) {
        _nestedScxmlIR = compileScxmlElement(
          normalizeElementNames(
            parseXml(resolveResource(options, assignedSource, 'invoke'))
          ),
          options
        );
      }
    } else if (content?.attributes?.expr) {
      const assignment = findEntryAssignment(String(content.attributes.expr));
      const assignedScxml = assignment?.elements?.find(
        (child) => child.name === 'scxml'
      );
      if (assignedScxml) {
        _nestedScxmlIR = compileScxmlElement(
          { elements: [assignedScxml] },
          options
        );
      }
    }

    const invokeId = String(
      element.attributes?.id ?? `${sanitizeStateId(id)}.invoke.${invokeIndex}`
    );
    const params = (element.elements ?? [])
      .filter((child) => child.name === 'param')
      .map((param) => ({
        name: String(param.attributes!.name),
        ...(param.attributes?.expr !== undefined
          ? { expr: String(param.attributes.expr) }
          : undefined),
        ...(param.attributes?.location !== undefined
          ? { location: String(param.attributes.location) }
          : undefined)
      }));
    const namelist = String(element.attributes?.namelist ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (element.attributes?.idlocation) {
      entry.push({
        type: 'scxml.assign',
        location: String(element.attributes.idlocation),
        expr: JSON.stringify(invokeId)
      });
    }

    return {
      id: invokeId,
      src: 'scxml.nested',
      _nestedScxmlIR,
      ...((params.length || namelist.length) && {
        _scxmlInput: {
          ...(params.length ? { params } : undefined),
          ...(namelist.length ? { namelist } : undefined)
        }
      })
    } as InvokeJSON & { _nestedScxmlIR?: ScxmlIR };
  });

  const autoForwardIds = invokeElements.flatMap((element, index) =>
    String(element.attributes?.autoforward) === 'true'
      ? [invoke[index].id!]
      : []
  );
  const finalizers = invokeElements.flatMap((element, index) => {
    const finalize = element.elements?.find(
      (child) => child.name === 'finalize'
    );
    return finalize
      ? [
          {
            invokeId: invoke[index].id!,
            actions: mapActions(finalize.elements ?? [], options)
          }
        ]
      : [];
  });
  if (finalizers.length) {
    for (const transitions of Object.values(on)) {
      for (const transition of Array.isArray(transitions)
        ? transitions
        : [transitions]) {
        transition._scxml = {
          ...transition._scxml,
          finalize: finalizers
        };
        transition.actions = [
          ...finalizers.map((finalizer) => ({
            type: 'scxml.finalize',
            ...finalizer
          })),
          ...(transition.actions ?? [])
        ];
      }
    }
  }
  if (autoForwardIds.length) {
    for (const transitions of Object.values(on)) {
      for (const transition of Array.isArray(transitions)
        ? transitions
        : [transitions]) {
        transition.actions = [
          ...autoForwardIds.map((invokeId) => ({
            type: 'scxml.forward',
            invokeId
          })),
          ...(transition.actions ?? [])
        ];
      }
    }
  }

  const resolvedInitial = initial && String(initial).split(' ');
  const hasExplicitInitial = hasInitialAttribute || !!initialElement;

  return {
    id: sanitizeStateId(id),
    ...(resolvedInitial && !hasExplicitInitial
      ? { initial: sanitizeStateId(resolvedInitial[0]) }
      : undefined),
    ...(resolvedInitial && hasExplicitInitial
      ? {
          _scxmlInitial: {
            targets: resolvedInitial.map(
              (target) => `#${sanitizeStateId(target)}`
            ),
            ...(initialActions?.length
              ? { actions: initialActions }
              : undefined)
          }
        }
      : undefined),
    ...(parallel ? { type: 'parallel' } : undefined),
    ...(nodeJson.name === 'final' ? { type: 'final' } : undefined),
    ...(donedataConfig ? { _scxmlDonedata: donedataConfig } : undefined),
    ...(Object.keys(states).length ? { states } : undefined),
    ...(Object.keys(on).length ? { on } : undefined),
    ...(always.length ? { always } : undefined),
    ...(entry.length ? { entry } : undefined),
    ...(exit?.length ? { exit } : undefined),
    ...(invoke.length ? { invoke } : undefined),
    ...(binding === 'late' && getDataDescriptors(nodeJson, options).length
      ? { _scxmlData: getDataDescriptors(nodeJson, options) }
      : undefined)
  };
}

function compileScxmlElement(
  scxmlJson: XMLElement,
  options: SCXMLConversionOptions
): ScxmlIR {
  const machineElement = scxmlJson.elements!.find(
    (element) => element.name === 'scxml'
  );
  if (!machineElement) {
    throw new Error('SCXML document must contain an <scxml> root element.');
  }

  const binding =
    machineElement.attributes?.binding === 'late' ? 'late' : 'early';
  const data = collectDataDescriptors(machineElement, options);
  const machineId = (machineElement.attributes?.name as string) || '(machine)';
  const stateNodeJSON = toStateNodeJSON(
    machineElement,
    machineId,
    undefined,
    binding,
    options
  );
  const declaredData = new Set(data.map(({ id }) => id));
  const removeStaticallyInvalidInvokes = (node: StateNodeJSON) => {
    if (node.invoke) {
      const invokes = Array.isArray(node.invoke) ? node.invoke : [node.invoke];
      const valid = invokes.filter((invocation) =>
        (invocation._scxmlInput?.namelist ?? []).every((name) =>
          declaredData.has(name)
        )
      );
      node.invoke = valid.length ? valid : undefined;
    }
    for (const child of Object.values(node.states ?? {})) {
      removeStaticallyInvalidInvokes(child);
    }
  };
  removeStaticallyInvalidInvokes(stateNodeJSON);

  return {
    ...stateNodeJSON,
    ...(binding === 'early' && data.length ? { _scxmlData: data } : undefined),
    ...(data.length ? { _scxmlDataIds: data.map(({ id }) => id) } : undefined)
  };
}

/**
 * Converts an SCXML string to a JSON representation that can be used with
 * the SCXML runtime compiler.
 */
export function compileSCXML(
  xml: string,
  options: SCXMLConversionOptions = {}
): ScxmlIR {
  const json = normalizeElementNames(parseXml(xml));
  return compileScxmlElement(json, options);
}

/**
 * Creates an XState machine from an SCXML document.
 *
 * Expressions and external resources are evaluated using SCXML semantics.
 * Only create machines from trusted SCXML because ECMAScript expressions and
 * script elements execute JavaScript in the current environment.
 */
export function createMachineFromSCXML(
  xml: string,
  options: SCXMLConversionOptions = {}
): AnyStateMachine {
  return createMachineFromSCXMLConfig(compileSCXML(xml, options));
}
