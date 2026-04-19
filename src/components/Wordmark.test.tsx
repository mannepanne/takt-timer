import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Wordmark } from './Wordmark';

describe('Wordmark', () => {
  it('renders the "takt" text with an accessible name', () => {
    render(<Wordmark />);
    expect(screen.getByLabelText('Takt')).toHaveTextContent('takt');
  });

  it('applies the requested font size', () => {
    render(<Wordmark size={32} />);
    expect(screen.getByLabelText('Takt')).toHaveStyle({ fontSize: '32px' });
  });
});
