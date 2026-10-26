import type { AnyActor } from './types.ts';

type TransitionSelectionFrame = {
  mode: 'abort' | 'suppress';
  parent: AnyActor | undefined;
  requiresReevaluation: boolean;
};

const selectionFrames: TransitionSelectionFrame[] = [];

export const transitionEffectSignal = new Error('Transition effect');

export function protectSelectionRelay(target: AnyActor): boolean {
  let matched = false;
  let abort = false;
  for (const frame of selectionFrames) {
    if (frame.parent === target) {
      frame.requiresReevaluation = true;
      matched = true;
      abort ||= frame.mode === 'abort';
    }
  }
  if (abort) {
    throw transitionEffectSignal;
  }
  return matched;
}

export function beginTransitionSelection(
  parent: AnyActor | undefined,
  mode: TransitionSelectionFrame['mode'] = 'abort'
) {
  const frame: TransitionSelectionFrame = {
    mode,
    parent,
    requiresReevaluation: false
  };
  selectionFrames.push(frame);
  return {
    frame,
    close() {
      selectionFrames.pop();
    }
  };
}
