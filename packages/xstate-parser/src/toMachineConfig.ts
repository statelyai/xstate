import {
  Actions,
  MachineConfig,
  StateNodeConfig,
  TransitionConfigOrTarget
} from 'xstate';
import { MaybeArrayOfActions } from './actions';
import { TMachineCallExpression } from './machineCallExpression';
import { StateNodeReturn } from './stateNode';
import { MaybeTransitionArray } from './transitions';
import { GetParserResult } from './utils';

const parseStateNode = (
  astResult: StateNodeReturn
): StateNodeConfig<any, any, any> => {
  const config: MachineConfig<any, any, any> = {};

  if (astResult?.id) {
    config.id = astResult.id.value;
  }

  if (astResult?.initial) {
    config.initial = astResult.initial.value;
  }

  if (astResult?.type) {
    config.type = astResult.type.value as any;
  }

  if (astResult.entry) {
    config.entry = getActionConfig(astResult.entry);
  }
  if (astResult.onEntry) {
    config.onEntry = getActionConfig(astResult.onEntry);
  }
  if (astResult.exit) {
    config.exit = getActionConfig(astResult.exit);
  }
  if (astResult.onExit) {
    config.onExit = getActionConfig(astResult.onExit);
  }

  if (astResult.on) {
    config.on = {};

    astResult.on.properties.forEach((onProperty) => {
      (config.on as any)[onProperty.key] = getTransitions(onProperty.result);
    });
  }

  if (astResult.after) {
    config.after = {};

    astResult.after.properties.forEach((afterProperty) => {
      (config.after as any)[afterProperty.key] = getTransitions(
        afterProperty.result
      );
    });
  }

  if (astResult.history) {
    config.history = astResult.history.value;
  }

  if (astResult.states) {
    const states: typeof config.states = {};

    astResult.states.properties.forEach((state) => {
      states[state.key] = parseStateNode(state.result);
    });

    config.states = states;
  }

  if (astResult.always) {
    config.always = getTransitions(astResult.always);
  }

  if (astResult.onDone) {
    // @ts-ignore
    config.onDone = getTransitions(astResult.onDone);
  }

  if (astResult.invoke) {
    const invokes: typeof config.invoke = [];

    astResult.invoke.forEach((invoke) => {
      const toPush: typeof invokes[number] = {
        src: 'anonymous'
      };
      if (invoke.src) {
        toPush.src = invoke.src.value;
      }

      if (invoke.id) {
        toPush.id = invoke.id.value;
      }

      if (invoke.autoForward) {
        toPush.autoForward = invoke.autoForward.value;
      }

      if (invoke.forward) {
        toPush.forward = invoke.forward.value;
      }

      if (invoke.onDone) {
        // @ts-ignore
        toPush.onDone = getTransitions(invoke.onDone);
      }

      if (invoke.onError) {
        // @ts-ignore
        toPush.onError = getTransitions(invoke.onError);
      }

      invokes.push(toPush);
    });

    if (invokes.length === 1) {
      config.invoke = invokes[0];
    } else {
      config.invoke = invokes;
    }
  }

  return config;
};

export const toMachineConfig = (
  result: TMachineCallExpression
): MachineConfig<any, any, any> | undefined => {
  if (!result?.definition) return undefined;
  return parseStateNode(result?.definition);
};

export const getActionConfig = (
  astActions: GetParserResult<typeof MaybeArrayOfActions>
): Actions<any, any> => {
  const actions: Actions<any, any> = [];

  astActions?.forEach((action) => {
    actions.push(action.action);
  });

  if (actions.length === 1) {
    return actions[0];
  }

  return actions;
};

export const getTransitions = (
  astTransitions: GetParserResult<typeof MaybeTransitionArray>
): TransitionConfigOrTarget<any, any> => {
  const transitions: TransitionConfigOrTarget<any, any> = [];

  astTransitions?.forEach((transition) => {
    const toPush: TransitionConfigOrTarget<any, any> = {};
    if (transition.target) {
      toPush.target = transition.target.value;
    }
    if (transition.cond) {
      toPush.cond = transition.cond.cond;
    }
    if (transition.actions) {
      toPush.actions = getActionConfig(transition.actions);
    }

    if (transition.internal) {
      toPush.internal = transition.internal.value;
    }

    transitions.push(toPush);
  });

  if (transitions.length === 1) {
    return transitions[0];
  }

  return transitions;
};
