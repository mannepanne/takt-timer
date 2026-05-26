// ABOUT: Bottom-sheet drawer that lists, pins, reorders, duplicates, and runs presets.
// ABOUT: Ported from the prototype's presets-settings.jsx design.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import {
  listPresets,
  updatePreset,
  deletePreset,
  createPreset,
  reorderPresets,
  type Preset,
} from '@/lib/presets';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function PresetsDrawer({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listPresets()
      .then(setPresets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  function runPreset(preset: Preset) {
    onClose();
    navigate('/run', {
      state: {
        session: {
          sets: preset.sets,
          workSec: preset.work_sec,
          restSec: preset.rest_sec,
          name: preset.name,
        },
      },
    });
  }

  async function togglePin(preset: Preset) {
    const updated = await updatePreset(preset.id, { pinned: preset.pinned ? 0 : 1 });
    setPresets((prev) =>
      prev
        .map((p) => (p.id === preset.id ? updated : p))
        .sort((a, b) => b.pinned - a.pinned || a.order_index - b.order_index),
    );
  }

  async function duplicate(preset: Preset) {
    const copy = await createPreset({
      name: `${preset.name} copy`,
      sets: preset.sets,
      work_sec: preset.work_sec,
      rest_sec: preset.rest_sec,
    });
    setPresets((prev) => [...prev, copy]);
  }

  async function remove(id: string) {
    await deletePreset(id);
    setPresets((prev) => prev.filter((p) => p.id !== id));
    setDeleteId(null);
  }

  function onDragStart(index: number) {
    dragItem.current = index;
  }

  function onDragEnter(index: number) {
    dragOver.current = index;
  }

  async function onDragEnd() {
    const from = dragItem.current;
    const to = dragOver.current;
    if (from === null || to === null || from === to) {
      dragItem.current = null;
      dragOver.current = null;
      return;
    }
    const reordered = [...presets];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setPresets(reordered);
    dragItem.current = null;
    dragOver.current = null;
    await reorderPresets(reordered.map((p) => p.id)).catch(() => {});
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
        <div className="presets-drawer-header">
          <h2 className="presets-drawer-title">Presets</h2>
          <button className="icon-btn" aria-label="Close presets" onClick={onClose} type="button">
            <Icon.Close size={20} />
          </button>
        </div>

        <div className="presets-drawer-list scroll">
          {loading && <p className="presets-drawer-empty">Loading…</p>}
          {!loading && presets.length === 0 && (
            <p className="presets-drawer-empty">No presets yet. Save a session to create one.</p>
          )}
          {presets.map((preset, index) => (
            <div
              key={preset.id}
              className={`preset-card${preset.pinned ? ' pinned' : ''}`}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragEnter={() => onDragEnter(index)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="preset-card-grip">
                <Icon.Grip size={16} color="var(--ink-muted)" />
              </div>
              <button
                type="button"
                className="preset-card-main"
                onClick={() => runPreset(preset)}
                aria-label={`Run ${preset.name}`}
              >
                <div className="title">{preset.name}</div>
                <div className="meta">
                  {preset.sets} sets · {preset.work_sec}s · {preset.rest_sec}s rest
                </div>
              </button>
              <div className="preset-card-actions">
                <button
                  type="button"
                  className={`star-btn${preset.pinned ? ' on' : ''}`}
                  aria-label={preset.pinned ? 'Unpin preset' : 'Pin preset'}
                  onClick={() => togglePin(preset)}
                >
                  <Icon.Star size={16} filled={!!preset.pinned} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Duplicate ${preset.name}`}
                  onClick={() => duplicate(preset)}
                >
                  <Icon.Copy size={16} />
                </button>
                {deleteId === preset.id ? (
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    aria-label="Confirm delete"
                    onClick={() => remove(preset.id)}
                  >
                    <Icon.Check size={16} color="var(--error)" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Delete ${preset.name}`}
                    onClick={() => setDeleteId(preset.id)}
                  >
                    <Icon.Trash size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
