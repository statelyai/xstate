import * as React from "react";
import { StateNode } from "xstate";
import { getChildren } from "./utils";

const StateNodeNav: React.FC<{
  stateNode: StateNode;
  depth?: number;
  onTap?: (stateNode: StateNode) => void;
  onHover?: (stateNode: StateNode) => void;
}> = ({ stateNode, depth = 0, onTap, onHover }) => {
  const childStateNodes = getChildren(stateNode);

  return (
    <details
      data-xviz="stateNodeNav"
      data-xviz-children={childStateNodes.length}
      open
      style={{
        // @ts-ignore
        "--xviz-depth": depth,
      }}
    >
      <summary
        data-xviz="stateNodeNav-content"
        title={`#${stateNode.id}`}
        onClick={(e) => {
          e.stopPropagation();

          onTap?.(stateNode);
        }}
        onMouseEnter={(e) => {
          e.stopPropagation();

          onHover?.(stateNode);
        }}
      >
        <div data-xviz="stateNodeNav-key">{stateNode.key}</div>
      </summary>
      <div data-xviz="stateNodeNav-children">
        {childStateNodes.map((sn) => {
          return (
            <StateNodeNav
              stateNode={sn}
              key={sn.id}
              depth={depth + 1}
              onTap={onTap}
            />
          );
        })}
      </div>
    </details>
  );
};

export { StateNodeNav };
