import * as React from 'react';
import { useContext, useRef, useState, useEffect } from 'react';

import { StateContext } from './StateContext';
import { TrackerData } from './tracker';

export function useTracking(id: string) {
  const { tracker } = useContext(StateContext);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!ref.current) {
      return;
    }

    tracker.update(id, ref.current);
  }, []);

  return ref;
}

export function useTracked(id: string): TrackerData | undefined {
  const { tracker } = useContext(StateContext);

  const [rect, setRect] = useState<TrackerData | undefined>();

  useEffect(() => {
    const listener = (data) => {
      setRect({ ...data });
    };

    tracker.listen(id, listener);

    return () => {
      tracker.unlisten(id, listener);
    };
  }, [id]);

  return rect;
}
