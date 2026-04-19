// ABOUT: TopBar renders a left slot, the centred wordmark, and a right slot.
// ABOUT: Slots are optional; empty slots reserve space so the wordmark stays centred.

import type { ReactNode } from 'react';

import { Wordmark } from '@/components/Wordmark';

type Props = {
  left?: ReactNode;
  right?: ReactNode;
};

export function TopBar({ left, right }: Props) {
  return (
    <div className="topbar">
      <div style={{ minWidth: 40 }}>{left}</div>
      <Wordmark />
      <div style={{ minWidth: 40, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  );
}
