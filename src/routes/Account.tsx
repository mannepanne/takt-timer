// ABOUT: Account route — sign out and account deletion for authenticated users.
// ABOUT: Minimal page; expanded with more settings in Phase 5.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { TopBar } from '@/components/TopBar';
import { signOut } from '@/lib/auth/client';
import { apiFetch } from '@/lib/apiFetch';
import { useSession } from '@/lib/auth/session';

export function Account() {
  const navigate = useNavigate();
  const { refresh } = useSession();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    await signOut();
    refresh();
    navigate('/');
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await apiFetch('/api/auth/me', { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      refresh();
      navigate('/');
    } catch {
      setError('Could not delete your account. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <div className="screen">
      <TopBar
        left={
          <button className="icon-btn" aria-label="Back" onClick={() => navigate(-1)} type="button">
            <Icon.Close />
          </button>
        }
      />

      <main className="account-body">
        <h1 className="account-title">Account</h1>
        <p className="account-description">
          Your account is pseudonymous — no email address, no personal data.
        </p>

        <div className="account-actions">
          <button type="button" className="btn btn-ghost" onClick={handleSignOut}>
            Sign out
          </button>

          {error && <p className="account-error">{error}</p>}

          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : confirmDelete ? 'Tap again to confirm' : 'Delete account'}
          </button>
          {confirmDelete && !deleting && (
            <p className="account-delete-warning">
              This will permanently delete your account, presets, and session history.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
