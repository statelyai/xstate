import { CircleContext, DEFAULT_CIRCLE_COLOR } from "@/machine";
import { getCircleById, ensureContrast } from "@/utils";
import { Pipette } from "lucide-react";

function Color() {
  const { send } = CircleContext.useActorRef();
  const { circles, selectedCircleId } = CircleContext.useSelector(
    (state) => state.context
  );
  const selectedCircle = getCircleById(circles, selectedCircleId);
  const color = selectedCircle?.color || DEFAULT_CIRCLE_COLOR;

  return (
    <div className="color-input">
      <label className="visually-hidden" htmlFor="color">
        Change Color
      </label>
      <input
        id="color"
        type="color"
        value={color}
        disabled={!selectedCircle}
        onClick={() => send({ type: "TOGGLE" })}
        onChange={(e) => {
          send({
            type: "START_EDIT",
          });
          send({
            type: "EDIT",
            setting: "color",
            value: e.currentTarget.value,
          });
        }}
        onBlur={(e) => {
          send({
            type: "END_EDIT",
            setting: "color",
            value: e.currentTarget.value,
          });
        }}
      />
      <span
        className="swatch-text"
        style={{ opacity: selectedCircle ? 1 : 0.5 }}
      >
        {color}
      </span>
      <Pipette style={{ stroke: ensureContrast(color) }} />
    </div>
  );
}

export default Color;
