import { ReactNode, useEffect, useRef } from 'react';

/**
 * Moves focus into the dialog when it mounts and returns it to
 * `returnFocusTo` (a DOM id recorded by the machine) when it unmounts.
 */
export function Dialog({
  title,
  returnFocusTo,
  isTop,
  children
}: {
  title: string;
  returnFocusTo: string | null;
  isTop: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]'
      )
      ?.focus();

    return () => {
      if (returnFocusTo) {
        document.getElementById(returnFocusTo)?.focus();
      }
    };
  }, [returnFocusTo]);

  return (
    <div className={`dialog ${isTop ? 'top' : 'behind'}`}>
      <div
        className="panel"
        role="dialog"
        aria-modal={isTop}
        aria-label={title}
        aria-hidden={!isTop}
        ref={ref}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
