import * as React from 'react';
import * as RTL from '@testing-library/react';

// TS trips over signatures with generic overloads when using bare `typeof RTL.render`
// conditional types just resolve the last overload
// and that is enough for us here
type SimplifiedRTLRender = (
  ...args: Parameters<typeof RTL.render>
) => ReturnType<typeof RTL.render>;

const reactModes = [
  ['non-strict', React.Fragment],
  ['strict', React.StrictMode]
] as const;

export function describeEachReactMode(
  name: string,
  fn: (suiteCase: {
    suiteKey: (typeof reactModes)[number][0];
    render: SimplifiedRTLRender;
  }) => void
) {
  describe.each(reactModes)(name, (suiteKey, Wrapper) => {
    const render: SimplifiedRTLRender = (ui, ...rest) =>
      RTL.render(<Wrapper>{ui}</Wrapper>, ...rest);

    fn({
      suiteKey,
      render: (...args) => {
        const renderResult = render(...args);
        const { rerender } = renderResult;
        renderResult.rerender = (ui) => rerender(<Wrapper>{ui}</Wrapper>);
        return renderResult;
      }
    });
  });
}
