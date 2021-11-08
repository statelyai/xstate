import {
  InterpreterFrom,
  StateFrom,
  StateMachine,
  StateNode,
  TransitionDefinition
} from '.';
import { interpret } from './interpreter';

/**
 * Plan:
 *
 * Ensure that the machine has a final state which is reachable
 *
 * Ensure every state with an invoke has an onError and a timeout
 */

type ValidationErrorType =
  | { type: 'state-not-final-nor-invocation'; stateId: string }
  | {
      type: 'no-error-transition-on-invoke-state';
      invocationId: string;
      stateId: string;
    }
  | {
      type: 'no-error-transition-without-cond-on-invoke-state';
      invocationId: string;
      stateId: string;
    }
  | {
      type: 'error-transition-targets-self';
      invocationId: string;
      stateId: string;
    }
  | {
      type: 'no-timeout';
      stateId: string;
    }
  | {
      type: 'no-timeout-without-cond';
      stateId: string;
    }
  | {
      type: 'timeout-targets-self';
      stateId: string;
    };

export const validatePromiseMachine = (
  machine: StateMachine<any, any, any>
) => {
  const errors: ValidationErrorType[] = [];

  const stateNodes = machine.stateIds.map((stateId) =>
    machine.getStateNodeById(stateId)
  );

  stateNodes.forEach((stateNode) => {
    if (!stateNode.parent) return;

    if (stateNode.type === 'final') return;

    if (stateNode.invoke.length === 0) {
      errors.push({
        type: 'state-not-final-nor-invocation',
        stateId: stateNode.id
      });
    }

    if (stateNode.invoke.length > 0) {
      stateNode.invoke.forEach((invocation) => {
        const invocationId = invocation.id;

        const errorTransitions = stateNode.transitions.filter((transition) => {
          return transition.eventType === `error.platform.${invocation.id}`;
        });

        if (errorTransitions.length === 0) {
          errors.push({
            type: 'no-error-transition-on-invoke-state',
            invocationId,
            stateId: stateNode.id
          });
        } else {
          const errorTransitionWithoutCond = errorTransitions.find(
            (transition) => !transition.cond
          );

          if (!errorTransitionWithoutCond) {
            errors.push({
              type: 'no-error-transition-without-cond-on-invoke-state',
              invocationId,
              stateId: stateNode.id
            });
          } else if (errorTransitionWithoutCond) {
            const allTransitionsGoNowhere = errorTransitionWithoutCond.target?.every(
              (node) => node.id === stateNode.id
            );

            if (allTransitionsGoNowhere) {
              errors.push({
                type: 'error-transition-targets-self',
                invocationId,
                stateId: stateNode.id
              });
            }
          }
        }
      });

      const timeoutTransitions = getAllAfterTransitions(stateNode);

      if (timeoutTransitions.length === 0) {
        errors.push({
          type: 'no-timeout',
          stateId: stateNode.id
        });
      } else if (timeoutTransitions.every((t) => t.cond)) {
        errors.push({
          type: 'no-timeout-without-cond',
          stateId: stateNode.id
        });
      }

      timeoutTransitions.forEach((transition) => {
        if (transition.target?.every((node) => node.id === stateNode.id)) {
          errors.push({
            type: 'timeout-targets-self',
            stateId: stateNode.id
          });
        }
      });
    }
  });

  return errors;
};

const getAllAfterTransitions = (
  node: StateNode
): TransitionDefinition<any, any>[] => {
  const transitions = node.transitions.filter((transition) => {
    return String(transition.eventType).includes('xstate.after');
  });

  if (transitions.length === 0 && node.parent) {
    return getAllAfterTransitions(node.parent);
  }
  return transitions;
};

const errorMap: {
  [K in ValidationErrorType['type']]: (
    error: Extract<ValidationErrorType, { type: K }>
  ) => string;
} = {
  'no-timeout': (error) =>
    `The state ${error.stateId} is missing a timeout. Use 'after' to ensure that it times out.`,
  'no-timeout-without-cond': (error) =>
    `The state ${error.stateId} has an 'after' transition declared, but it is not guaranteed to be taken because it has a guard. Add an unguarded transition.`,
  'error-transition-targets-self': (error) =>
    `The onError transition for ${error.invocationId} on ${error.stateId} targets its own state. Give it a target to avoid infinite loops.`,
  'timeout-targets-self': (error) =>
    `The state ${error.stateId} has an 'after' transition declared, but it targets itself. Give it a target to avoid infinite loops.`,
  'state-not-final-nor-invocation': (error) =>
    `The state ${error.stateId} should either run an invocation via invoke: {}, or be of type 'final'. Choose one or the other to avoid infinite loops.`,
  'no-error-transition-on-invoke-state': (error) =>
    `No onError transition declared for ${error.invocationId} on ${error.stateId}.`,
  'no-error-transition-without-cond-on-invoke-state': (error) =>
    `The invocation ${error.invocationId} on ${error.stateId} has an onError declared, but it is not guaranteed to be taken because it has a guard. Add an unguarded transition.`
};

const getErrorString = (error: ValidationErrorType) => {
  return errorMap[error.type](error as any);
};

export const toPromise = async <TMachine extends StateMachine<any, any, any>>(
  machine: TMachine
): Promise<StateFrom<TMachine>> => {
  const validationErrors = validatePromiseMachine(machine);

  validationErrors.forEach((error) => {
    const errorString = getErrorString(error);
    throw new Error(errorString);
  });

  return new Promise((resolve, reject) => {
    try {
      const service = interpret(machine);

      service.onStop(() => {
        resolve(service.state as StateFrom<TMachine>);
      });

      service.start();
    } catch (e) {
      reject(e);
    }
  });
};

// const machine = createMachine({
//   initial: 'gettingUserDetails',
//   states: {
//     gettingUserDetails: {
//       after: {
//         10000: 'timedOut'
//       },
//       invoke: {
//         src: 'getUserDetails',
//         onDone: {
//           target: 'receivedUserDetails'
//         },
//         onError: {
//           target: 'errored'
//         }
//       }
//     },
//     timedOut: {
//       type: 'final'
//     },
//     errored: {
//       type: 'final'
//     },
//     receivedUserDetails: {
//       type: 'final'
//     }
//   }
// });
