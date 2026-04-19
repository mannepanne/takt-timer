// ABOUT: Wraps the app in the phone-shaped viewport used on all screen sizes.
// ABOUT: On desktop (>=480px wide) the viewport is rounded and lifted on a dark canvas;
// ABOUT: on mobile it fills the screen edge-to-edge.

import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function PhoneFrame({ children }: Props) {
  return (
    <div className="app-shell">
      <div className="app-viewport">{children}</div>
    </div>
  );
}
