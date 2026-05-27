// ABOUT: Bottom-sheet drawer that lists, pins, renames, duplicates, and runs presets.
// ABOUT: Ported from the prototype's presets-settings.jsx design.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { useI18n } from '@/i18n/context';
import { listPresets, updatePreset, deletePreset, createPreset, type Preset } from '@/lib/presets';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function PresetsDrawer({ open, onClose }: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

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
          <h2 className="presets-drawer-title">{t('presets.title')}</h2>
          <button
            className="icon-btn"
            aria-label={t('presets.close')}
            onClick={onClose}
            type="button"
          >
            <Icon.Close size={20} />
          </button>
        </div>

        <div className="presets-drawer-list scroll">
          {loading && <p className="presets-drawer-empty">{t('presets.loading')}</p>}
          {!loading && fetchError && (
            <p className="presets-drawer-error">{t('presets.loadError')}</p>
          )}
          {!loading && !fetchError && presets.length === 0 && (
            <p className="presets-drawer-empty">{t('presets.empty')}</p>
          )}
          {presets.map((preset) => (
            <div key={preset.id} className={`preset-card${preset.pinned ? ' pinned' : ''}`}>
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
                    aria-label={t('presets.rename.label')}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('presets.rename.save')}
                    onClick={commitRename}
                  >
                    <Icon.Check size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('presets.rename.cancel')}
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
                  aria-label={t('presets.run', { name: preset.name })}
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
                  className={`star-btn${preset.pinned ? ' on' : ''}`}
                  aria-label={
                    preset.pinned
                      ? t('presets.unpin', { name: preset.name })
                      : t('presets.pin', { name: preset.name })
                  }
                  onClick={() => togglePin(preset)}
                >
                  <Icon.Star size={16} filled={!!preset.pinned} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('presets.rename.aria', { name: preset.name })}
                  onClick={() => startRename(preset)}
                >
                  <Icon.Edit size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('presets.duplicate', { name: preset.name })}
                  onClick={() => duplicate(preset)}
                >
                  <Icon.Copy size={16} />
                </button>
                {deleteId === preset.id ? (
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger-confirm"
                    aria-label={t('presets.delete.confirm')}
                    onClick={() => remove(preset.id)}
                  >
                    <Icon.Question size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('presets.delete.aria', { name: preset.name })}
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
