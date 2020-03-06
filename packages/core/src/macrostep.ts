import { StateNode } from './StateNode';
import {
  isAtomicStateNode,
  getProperAncestors,
  evaluateGuard,
  removeConflictingTransitions,
  microstep,
  getStateValue,
  transitionNode
} from './stateUtils';
import { nullEvent } from './actionTypes';
import { State } from './State';
import {
  TransitionDefinition,
  ActionObject,
  EventObject,
  SCXML
} from './types';
import { start } from './actions';
import { toSCXMLEvent } from './utils';
import { MachineNode } from './MachineNode';

function log(...msgs) {
  if (1 + 1 === 3) {
    log(...msgs);
  }
}

export function macrostep<TContext, TEvent extends EventObject>(
  state: State<TContext, TEvent>,
  _event: SCXML.Event<TEvent>,
  machine: MachineNode<TContext, any, TEvent, any>
) {
  log(`State: ${JSON.stringify(state.value)}`);
  log(`Event: ${JSON.stringify(_event.data)}`);
  const statesToInvoke = new Set<StateNode<TContext, any, TEvent>>();
  const configuration = new Set(state.configuration);
  let macrostepDone = false;
  const internalQueue: TEvent[] = [];

  const actions: Array<ActionObject<any, any>> = [];
  let enabledTransitions = new Set<TransitionDefinition<TContext, TEvent>>();
  // selectEventlessTransitions(
  //   configuration,
  //   state,
  //   machine
  // );
  const res = {
    actions: state.actions,
    configuration,
    historyValue: state.historyValue
  };

  let counter = 0;
  while (!macrostepDone || counter++ < 5) {
    if (!enabledTransitions.size) {
      if (!internalQueue.length) {
        macrostepDone = true;
      } else {
        const internalEvent = internalQueue.shift()!;
        log(`Internal: ${internalEvent.type}`);
        enabledTransitions = selectTransitions(
          configuration,
          state,
          internalEvent,
          machine
        );
      }
    }
    log(
      `Enabled eventless transitions: (${enabledTransitions.size})\n` +
        [...enabledTransitions]
          .map(t => {
            return t.target ? t.target.map(target => target.id) : '--';
          })
          .join(', ')
    );
    if (enabledTransitions.size > 0) {
      const microstepRes = microstep(
        Array.from(enabledTransitions),
        state,
        configuration
      );

      res.actions.push(...microstepRes.actions);
      res.configuration = microstepRes.configuration;
      res.historyValue = microstepRes.historyValue;
    }
  }

  // for state in statesToInvoke.sort(entryOrder):
  //           for inv in state.invoke.sort(documentOrder):
  //               invoke(inv)
  //       statesToInvoke.clear()
  for (const stateNode of Array.from(statesToInvoke).sort(
    (a, b) => a.order - b.order
  )) {
    actions.push(...stateNode.invoke.map(invokeDef => start(invokeDef)));
  }
  statesToInvoke.clear();

  // enabledTransitions = selectTransitions(configuration, state, _event);
  const transitions = transitionNode(machine, state.value, state, _event);
  enabledTransitions = transitions ? new Set(transitions) : new Set();

  log(
    `Enabled transitions: (${enabledTransitions.size})\n` +
      [...enabledTransitions]
        .map(t => {
          return t.target ? t.target.map(target => target.id) : '--';
        })
        .join(', ')
  );

  if (enabledTransitions.size > 0) {
    const microstepRes = microstep(
      Array.from(enabledTransitions),
      state,
      configuration
    );

    res.actions = res.actions.concat(...microstepRes.actions);
    res.configuration = microstepRes.configuration;
    res.historyValue = microstepRes.historyValue;
  }

  return new State({
    value: getStateValue(machine, Array.from(res.configuration)),
    context: state.context, // todo: evaluate
    _event: toSCXMLEvent(_event),
    _sessionid: state._sessionid,
    configuration: Array.from(res.configuration),
    transitions: Array.from(enabledTransitions),
    children: []
  });

  return res;
}

// function selectEventlessTransitions():
//     enabledTransitions = new OrderedSet()
//     atomicStates = configuration.toList().filter(isAtomicState).sort(documentOrder)
//     for state in atomicStates:
//         loop: for s in [state].append(getProperAncestors(state, null)):
//             for t in s.transition.sort(documentOrder):
//                 if not t.event and conditionMatch(t):
//                     enabledTransitions.add(t)
//                     break loop
//     enabledTransitions = removeConflictingTransitions(enabledTransitions)
//     return enabledTransitions

function selectEventlessTransitions(
  configuration: Set<StateNode<any, any, any>>,
  state: State<any, any>,
  machine: MachineNode<any, any>
) {
  let enabledTransitions = new Set<TransitionDefinition<any, any>>();
  const atomicStateNodes = Array.from(configuration).filter(isAtomicStateNode);

  for (const stateNode of atomicStateNodes) {
    loop: for (const s of [stateNode].concat(
      getProperAncestors(stateNode, null)
    )) {
      // TODO: documentOrder and transition.order
      for (const t of s.transitions.sort(/* (a, b) => a.order - b.order) */)) {
        const guardPassed =
          !t.cond ||
          evaluateGuard(machine, t.cond, state.context, state._event, state);
        if (t.eventType === nullEvent && guardPassed) {
          enabledTransitions.add(t);
          break loop;
        }
      }
    }
  }

  enabledTransitions = removeConflictingTransitions(
    Array.from(enabledTransitions),
    configuration,
    state
  );
  return enabledTransitions;
}

// function selectTransitions(event):
//     enabledTransitions = new OrderedSet()
//     atomicStates = configuration.toList().filter(isAtomicState).sort(documentOrder)
//     for state in atomicStates:
//         loop: for s in [state].append(getProperAncestors(state, null)):
//             for t in s.transition.sort(documentOrder):
//                 if t.event and nameMatch(t.event, event.name) and conditionMatch(t):
//                     enabledTransitions.add(t)
//                     break loop
//     enabledTransitions = removeConflictingTransitions(enabledTransitions)
//     return enabledTransitions

function eventNameMatch(
  transitionEventType: string,
  eventType: string
): boolean {
  return transitionEventType === eventType;
}

function selectTransitions(
  configuration: Set<StateNode<any, any, any>>,
  state: State<any, any>,
  event: EventObject,
  machine: MachineNode<any, any>
) {
  let enabledTransitions = new Set<TransitionDefinition<any, any>>();

  const atomicStateNodes = Array.from(configuration)
    .filter(isAtomicStateNode)
    .sort(/* documentOrder */);

  for (const stateNode of atomicStateNodes) {
    loop: for (const s of [stateNode].concat(
      getProperAncestors(stateNode, null)
    )) {
      for (const t of s.transitions.sort(/* documentorder */)) {
        const guardPassed =
          !t.cond ||
          evaluateGuard(machine, t.cond, state.context, state._event, state);

        if (
          t.eventType !== nullEvent &&
          eventNameMatch(t.eventType, event.type) &&
          guardPassed
        ) {
          enabledTransitions.add(t);
          break loop;
        }
      }
    }
  }

  enabledTransitions = removeConflictingTransitions(
    Array.from(enabledTransitions),
    configuration,
    state
  );

  return enabledTransitions;
}
