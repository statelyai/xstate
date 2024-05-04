import { ComponentProps, useRef, useState, useCallback } from "react";

type Props = {
  children: React.ReactNode;
  props: ComponentProps<"button">;
};

const ControlButton = ({ children, ...props }: Props) => {
  const timeout = useRef();
  const interval = useRef();

  const repeater = () => {
    interval.current = setInterval(onClick, 125);
  };

  const stop = () => {
    clearTimeout(timeout.current);
    clearInterval(interval.current);
  };
  return (
    <button
    {...props}
      onPointerDown={() => {
        onClick();
        timeout.current = setTimeout(repeater, 500);
      }}
      onPointerUp={stop}
      onPointerOut={stop}
      onPointerLeave={stop}
    >
      {children}
    </button>
  );
};

export const Number = ({
  readOnly = false,
  min = "-5000",
  max = "5000",
  step = 5,
}) => {
  const inputEl = useRef(null);
  const [value, setValue] = useState(0);
  const decrease = useCallback(
    () => setValue((v) => v - step),
    [setValue, step]
  );
  const increase = useCallback(
    () => setValue((v) => v + step),
    [setValue, step]
  );

  return (
    <div className="flex">
      <ControlButton  className="end-cap"  onClick={decrease}>-</ControlButton>
      <input
        type="number"
        tabIndex={0}
        ref={inputEl}
        readOnly={readOnly}
        placeholder={min.toString()}
        min={min}
        max={max}
        step={step}
        onChange={(event) => setValue(event.target.value)}
        value={value}
        onKeyDown={(e) => {
          e.code === "Space" && e.preventDefault();
        }}
      />
      <ControlButton onClick={increase}>+</ControlButton>
    </div>
  );
};
