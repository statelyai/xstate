import { useEffect, useRef, useState } from 'react';

export function useScheduleEffect() {
  const effectsRef = useRef<any[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    while (effectsRef.current.length) {
      const effect = effectsRef.current.shift();

      effect();
    }
  }, [count]);

  return function schedule(effect: (...args: any[]) => any) {
    effectsRef.current.push(effect);
    setCount(count + 1);
  };
}
