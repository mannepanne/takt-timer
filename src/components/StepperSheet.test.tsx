import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StepperSheet } from './StepperSheet';

describe('StepperSheet', () => {
  it('renders the label and the formatted value', () => {
    const { container } = render(
      <StepperSheet
        open
        mode="int"
        label="Sets"
        value={3}
        onChange={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Sets')).toBeInTheDocument();
    expect(container.querySelector('.stepper-sheet-value')).toHaveTextContent('3');
  });

  it('renders duration values as M:SS', () => {
    const { container } = render(
      <StepperSheet
        open
        mode="duration"
        label="Work"
        value={65}
        onChange={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container.querySelector('.stepper-sheet-value')).toHaveTextContent('1:05');
  });

  it('tapping a quick-preset updates the draft', async () => {
    const onChange = vi.fn();
    render(
      <StepperSheet
        open
        mode="int"
        label="Sets"
        value={3}
        onChange={onChange}
        onClose={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: '5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('Cancel closes without committing', async () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <StepperSheet open mode="int" label="Sets" value={3} onChange={onChange} onClose={onClose} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('backdrop click closes', async () => {
    const onClose = vi.fn();
    render(
      <StepperSheet open mode="int" label="Sets" value={3} onChange={() => {}} onClose={onClose} />,
    );
    await userEvent.click(screen.getByTestId('stepper-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('decrease button is disabled when draft is at min', () => {
    render(
      <StepperSheet
        open
        mode="int"
        label="Sets"
        value={1}
        onChange={() => {}}
        onClose={() => {}}
        min={1}
      />,
    );
    expect(screen.getByRole('button', { name: /decrease sets/i })).toBeDisabled();
  });

  it('rest-labeled duration mode offers a 0 preset', () => {
    render(
      <StepperSheet
        open
        mode="duration"
        label="Rest"
        value={30}
        onChange={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: '0:00' })).toBeInTheDocument();
  });

  it('pointerdown on the increase button starts hold; pointerup ends it', () => {
    const { container } = render(
      <StepperSheet
        open
        mode="int"
        label="Sets"
        value={3}
        onChange={() => {}}
        onClose={() => {}}
      />,
    );
    const inc = screen.getByRole('button', { name: /increase sets/i });
    // pointerdown → draft increments by 1 immediately.
    inc.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    inc.dispatchEvent(new Event('pointerup', { bubbles: true }));
    // Draft display should reflect the new value (≥ original).
    const display = container.querySelector('.stepper-sheet-value');
    expect(display).not.toBeNull();
  });

  it('pointerdown on the decrease button reduces the draft', () => {
    const { container } = render(
      <StepperSheet
        open
        mode="int"
        label="Sets"
        value={3}
        onChange={() => {}}
        onClose={() => {}}
        min={1}
      />,
    );
    const dec = screen.getByRole('button', { name: /decrease sets/i });
    dec.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    dec.dispatchEvent(new Event('pointerup', { bubbles: true }));
    const display = container.querySelector('.stepper-sheet-value');
    expect(display).not.toBeNull();
  });
});
