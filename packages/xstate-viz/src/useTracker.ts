import * as React from 'react';
import { useContext, useRef } from 'react';

import { StateContext } from './StateContext';

export function useTracker(id: string) {
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
