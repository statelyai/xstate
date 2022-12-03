// hello

import { AnyState } from 'xstate';

export type StateListener = (state: AnyState) => void;

interface TransitionsAnalysis {
  count: number;
  transitions: Record<string, Record<string, TransitionAnalysis>>;
}

interface TransitionAnalysis {
  count: number;
  /**
   * Resulting target state
   */
  state: string;
  /**
   * Overall weight
   */
  weight: number;
  /**
   * Weight based on current state
   */
  currentWeight: number;
  relativeWeight: number;
}

const serializeState = (state?: AnyState): string => {
  if (!state) {
    return '';
  }
  const { value, context } = state;

  return JSON.stringify({ value, context });
};

interface AnalyzerOptions {
  filter: (state: AnyState) => boolean;
  history?: TransitionsAnalysis;
}

const defaultAnalyzerOptions: AnalyzerOptions = {
  filter: () => true
};

export function createAnalyzer(
  callback: (analysis: TransitionsAnalysis) => void,
  options?: Partial<AnalyzerOptions>
): StateListener {
  const resolvedOptions = {
    ...defaultAnalyzerOptions,
    ...options
  };
  const analysis: TransitionsAnalysis = resolvedOptions.history || {
    count: 0,
    transitions: {}
  };

  return (state: AnyState) => {
    if (!resolvedOptions.filter(state)) {
      return;
    }

    const stateSerial = serializeState(state);
    const prevState = state.history;
    const prevStateSerial = serializeState(prevState);
    const eventSerial = JSON.stringify(state.event);

    analysis.count++;

    if (!analysis.transitions[prevStateSerial]) {
      analysis.transitions[prevStateSerial] = {};
    }

    if (!analysis.transitions[prevStateSerial][eventSerial]) {
      analysis.transitions[prevStateSerial][eventSerial] = {
        count: 0,
        state: stateSerial,
        get weight() {
          return this.count / analysis.count;
        },
        get currentWeight() {
          return (
            this.count /
            Object.keys(analysis.transitions[prevStateSerial])
              .map((key) => analysis.transitions[prevStateSerial][key])
              .reduce((acc, a) => {
                return a.count + acc;
              }, 0)
          );
        },
        get relativeWeight() {
          return (
            this.count /
            (analysis.count / Object.keys(analysis.transitions).length)
          );
        }
      };
    }

    const transitionAnalysis =
      analysis.transitions[prevStateSerial][eventSerial];

    transitionAnalysis.count++;

    callback(analysis);
  };
}
