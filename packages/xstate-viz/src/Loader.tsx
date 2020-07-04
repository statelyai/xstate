import * as React from 'react';
import { Logo } from './Logo';

export const Loader: React.FC = ({ children }) => {
  return (
    <div data-xviz="loader">
      <Logo />
      <div data-xviz="loader-message">{children}</div>
    </div>
  );
};
