// Smoke test — icons.tsx has no logic, just SVG markup; one render each proves the barrel works.
// The file is excluded from coverage by convention; this test exists for regression safety.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Icon } from './icons';

describe('Icon', () => {
  it('renders every icon without throwing', () => {
    const names = Object.keys(Icon) as (keyof typeof Icon)[];
    for (const name of names) {
      const Component = Icon[name];
      const { container, unmount } = render(<Component />);
      expect(container.querySelector('svg')).not.toBeNull();
      unmount();
    }
  });
});
