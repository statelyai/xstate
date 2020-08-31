import * as React from "react";
import { useTracked } from "./useTracker";

export const Popover: React.FC<{
  trackingId: string;
  actions?: JSX.Element;
}> = ({ children, trackingId, actions }) => {
  const rectData = useTracked(trackingId);

  if (!rectData) {
    return null;
  }

  return (
    <div
      data-xviz="popover"
      style={{
        // @ts-ignore
        "--xviz-tracked-left": rectData.rect.left,
        "--xviz-tracked-top": rectData.rect.top,
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div data-xviz="popover-content">{children}</div>
      <div data-xviz="popover-actions">{actions}</div>
    </div>
  );
};
