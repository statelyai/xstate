import * as React from 'react';
import { StateMachine } from 'xstate';
import { Rect } from './Rect';
import { StateNodeViz } from './StateNodeViz';

export type MachineRectMeasurements = Record<
  string,
  {
    state: Rect;
    events: Rect;
  }
>;

export const MachineMeasure: React.FC<{
  onMeasure?: (rects: any) => void;
  machine: StateMachine<any, any, any>;
}> = ({ onMeasure, machine }) => {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!ref.current) {
      return;
    }

    const mapping: MachineRectMeasurements = {};

    const stateNodeEls = ref.current!.querySelectorAll(
      `[data-xviz="stateNode"]`
    );

    stateNodeEls.forEach((stateNodeEl: HTMLDivElement) => {
      const id = stateNodeEl.dataset.xvizId!;

      const sn = machine.getStateNodeById(id);

      mapping[id] = {
        state: new Rect(
          stateNodeEl
            .querySelector('[data-xviz="stateNode-state"]')!
            .getBoundingClientRect()
        ),
        events: new Rect(
          stateNodeEl
            .querySelector('[data-xviz="events"]')!
            .getBoundingClientRect()
        )
      };

      (sn as any).viz = mapping[id];
    });

    onMeasure?.(mapping);
  });

  return (
    <div ref={ref}>
      <StateNodeViz stateNode={machine} />
    </div>
  );
};
