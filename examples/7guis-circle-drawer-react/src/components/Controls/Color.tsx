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
    <div className="color">
      <label className="visually-hidden" htmlFor="color">
        Change Color
      </label>
      <input
        id="color"
        type="color"
        value={color}
        disabled={!selectedCircle}
        onChangeCapture={() => {
          if (circles.length === 0) return;
          send({
            type: "START_EDIT",
          });
        }}
        onChange={(e) => {
          send({
            type: "EDIT",
            setting: "color",
            value: e.currentTarget.value,
          });
        }}
        onPointerUp={() => {
          send({
            type: "END_EDIT",
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
