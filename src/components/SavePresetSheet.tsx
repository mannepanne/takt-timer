// ABOUT: Bottom sheet for saving the current session as a named preset.
// ABOUT: Type-only mode in Phase 4; voice save is Phase 5.

import { useState } from 'react';

import { createPreset } from '@/lib/presets';
import type { Session } from '@/lib/timer/types';

type Props = {
  open: boolean;
  session: Session;
  onClose: () => void;
  onSaved: () => void;
};

export function SavePresetSheet({ open, session, onClose, onSaved }: Props) {
  const [name, setName] = useState(session.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a name for this preset.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createPreset({
        name: trimmed,
        sets: session.sets,
        work_sec: session.workSec,
        rest_sec: session.restSec,
      });
      onSaved();
    } catch {
      setError('Could not save preset. Please try again.');
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className={`drawer-backdrop${open ? ' open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={`drawer${open ? ' open' : ''}`} role="dialog" aria-modal="true">
        <div className="drawer-handle" />
        <div className="save-preset-body">
          <h2 className="save-preset-title">Save as preset</h2>
          <p className="save-preset-meta">
            {session.sets} sets · {session.workSec}s work · {session.restSec}s rest
          </p>
          <label className="save-preset-label" htmlFor="preset-name">
            Name
          </label>
          <input
            id="preset-name"
            className="save-preset-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Leg day"
            maxLength={80}
            autoFocus
          />
          {error && <p className="save-preset-error">{error}</p>}
          <div className="save-preset-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
