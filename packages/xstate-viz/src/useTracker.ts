import * as React from 'react';
import { useContext, useRef, useState } from 'react';

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

export function useTracked(id: string) {
  const { tracker } = useContext(StateContext);

  const [rect, setRect] = useState<TrackerData | undefined>();

  React.useEffect(() => {
    tracker.listen(id, data => setRect(data));
  }, [id]);

  return rect;
}
