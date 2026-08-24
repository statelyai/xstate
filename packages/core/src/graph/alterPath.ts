import { XSTATE_INIT } from '../constants.ts';
import { StatePath } from './types.ts';

// TODO: rewrite parts of the algorithm leading to this to make this function obsolete
export function alterPath<T extends StatePath<any, any>>(path: T): T {
  let steps: T['steps'] = [];

  if (!path.steps.length) {
    steps = [
      {
        state: path.state,
        event: { type: XSTATE_INIT }
      }
    ];
  } else {
    for (let i = 0; i < path.steps.length; i++) {
      const step = path.steps[i];

      steps.push({
        state: step.state,
        event: i === 0 ? { type: XSTATE_INIT } : path.steps[i - 1].event
      });
    }
    steps.push({
      state: path.state,
      event: path.steps[path.steps.length - 1].event
    });
  }
  return {
    ...path,
    steps
  };
}
