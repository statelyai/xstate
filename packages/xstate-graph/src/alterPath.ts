import { StatePath } from './types';

// TODO: rewrite parts of the algorithm leading to this to make this function obsolete
export function alterPath<T extends StatePath<any, any>>(path: T): T {
  let steps: T['steps'] = [];

  if (!path.steps.length) {
    steps = [
      {
        state: path.state,
        event: { type: 'xstate.init' } as any
      }
    ];
  } else {
    for (let i = 0; i < path.steps.length; i++) {
      const step = path.steps[i];

      steps.push({
        state: step.state,
        event: i === 0 ? { type: 'xstate.init' } : path.steps[i - 1].event
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
