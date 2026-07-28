import { useEffect, useState } from 'react';
import type { UpdateState } from '../../../shared/ipc-contract.js';

/**
 * Update status.
 *
 * Deliberately quiet: it shows nothing at all while idle, up to date, or on a
 * development build, and only takes space when there is something worth
 * saying. Nothing here can restart the app on its own — a design being
 * digitized is unsaved work, so applying an update is always the user's click.
 */

export function useUpdateState(): UpdateState {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });

  useEffect(() => {
    void window.embroider.getUpdateState().then(setState);
    return window.embroider.onUpdateState(setState);
  }, []);

  return state;
}

export function UpdateBanner({ state }: { state: UpdateState }): JSX.Element | null {
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (state.status === 'ready') {
    const key = `ready-${state.version ?? ''}`;
    if (dismissed === key) return null;
    return (
      <div className="update-banner">
        <span>
          Version {state.version} is downloaded and ready. Save your work first — installing
          restarts the app.
        </span>
        <button type="button" className="primary" onClick={() => window.embroider.installUpdate()}>
          Restart and update
        </button>
        <button type="button" onClick={() => setDismissed(key)}>
          Later
        </button>
      </div>
    );
  }

  if (state.status === 'downloading') {
    return (
      <div className="update-banner update-banner-quiet">
        <span>
          Downloading version {state.version ?? 'update'} — {state.percent}%
        </span>
        <span className="update-progress">
          <span className="update-progress-fill" style={{ width: `${state.percent}%` }} />
        </span>
      </div>
    );
  }

  return null;
}

/** The one-line form for the status bar, which has room for a word or two. */
export function updateStatusLabel(state: UpdateState): string | null {
  switch (state.status) {
    case 'checking':
      return 'Checking for updates…';
    case 'downloading':
      return `Downloading update ${state.percent}%`;
    case 'ready':
      return `Update ${state.version ?? ''} ready`;
    case 'error':
      return `Update check failed: ${state.message}`;
    default:
      return null;
  }
}
