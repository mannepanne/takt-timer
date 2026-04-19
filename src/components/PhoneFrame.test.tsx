import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PhoneFrame } from './PhoneFrame';

describe('PhoneFrame', () => {
  it('renders children inside the app-viewport wrapper', () => {
    render(
      <PhoneFrame>
        <div data-testid="inner">hello</div>
      </PhoneFrame>,
    );
    const inner = screen.getByTestId('inner');
    expect(inner).toBeInTheDocument();
    expect(inner.closest('.app-viewport')).not.toBeNull();
    expect(inner.closest('.app-shell')).not.toBeNull();
  });
});
