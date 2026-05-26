// ABOUT: Bottom-sheet drawer that lists, pins, renames, reorders, duplicates, and runs presets.
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
  const [fetchError, setFetchError] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [mutateError, setMutateError] = useState<string | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setFetchError(false);
    listPresets()
      .then(setPresets)
      .catch(() => setFetchError(true))
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

  function startRename(preset: Preset) {
    setRenameId(preset.id);
    setRenameValue(preset.name);
  }

  async function commitRename() {
    if (!renameId || !renameValue.trim()) return;
    const updated = await updatePreset(renameId, { name: renameValue.trim() });
    setPresets((prev) => prev.map((p) => (p.id === renameId ? updated : p)));
    setRenameId(null);
  }

  async function applyReorder(reordered: Preset[]) {
    const previous = presets;
    setPresets(reordered);
    setMutateError(null);
    try {
      await reorderPresets(reordered.map((p) => p.id));
    } catch {
      setPresets(previous);
      setMutateError("Couldn't reorder. Try again.");
    }
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
    dragItem.current = null;
    dragOver.current = null;
    if (from === null || to === null || from === to) return;
    const reordered = [...presets];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    await applyReorder(reordered);
  }

  async function moveUp(index: number) {
    if (index <= 0) return;
    const reordered = [...presets];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    await applyReorder(reordered);
  }

  async function moveDown(index: number) {
    if (index >= presets.length - 1) return;
    const reordered = [...presets];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    await applyReorder(reordered);
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

        {mutateError && <p className="presets-drawer-error">{mutateError}</p>}

        <div className="presets-drawer-list scroll">
          {loading && <p className="presets-drawer-empty">Loading…</p>}
          {!loading && fetchError && (
            <p className="presets-drawer-error">Could not load presets. Check your connection.</p>
          )}
          {!loading && !fetchError && presets.length === 0 && (
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
              {renameId === preset.id ? (
                <div className="preset-card-rename">
                  <input
                    className="preset-rename-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitRename();
                      if (e.key === 'Escape') setRenameId(null);
                    }}
                    aria-label="Rename preset"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Save rename"
                    onClick={commitRename}
                  >
                    <Icon.Check size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Cancel rename"
                    onClick={() => setRenameId(null)}
                  >
                    <Icon.Close size={16} />
                  </button>
                </div>
              ) : (
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
              )}
              <div className="preset-card-actions">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Move ${preset.name} up`}
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                >
                  <Icon.ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Move ${preset.name} down`}
                  onClick={() => moveDown(index)}
                  disabled={index === presets.length - 1}
                >
                  <Icon.ChevronDown size={16} />
                </button>
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
                  aria-label={`Rename ${preset.name}`}
                  onClick={() => startRename(preset)}
                >
                  <Icon.Edit size={16} />
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
