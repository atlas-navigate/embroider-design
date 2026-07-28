import { app, BrowserWindow, dialog } from 'electron';
import electronUpdater from 'electron-updater';
import { IPC, type UpdateState } from '../shared/ipc-contract.js';

/**
 * Automatic updates, from this project's own GitHub Releases.
 *
 * The check runs every 30 minutes and the download happens in the background,
 * because an embroidery session is not something to interrupt: a design being
 * digitized is unsaved work, and a machine may be mid-run. So nothing is ever
 * installed underneath the user — the new version is fetched quietly and
 * applied on the next restart, or immediately if they ask for it.
 *
 * Requires the app to be packaged and signed-or-not-signed NSIS from
 * electron-builder with `publish: github`; in development `autoUpdater` has no
 * `app-update.yml` to read and every check is reported as unsupported rather
 * than as an error.
 */

// electron-updater is CommonJS; the named export is not reachable under ESM.
const { autoUpdater } = electronUpdater;

/** Long enough not to hammer the GitHub API, short enough to matter. */
export const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/** GitHub rate-limits unauthenticated calls; back off hard after a failure. */
const FAILURE_BACKOFF_MS = 4 * 60 * 60 * 1000;

let state: UpdateState = { status: 'idle' };
let timer: ReturnType<typeof setInterval> | null = null;
let getWindowRef: () => BrowserWindow | null = () => null;
/** The version being fetched. Kept aside so progress events can name it. */
let pendingVersion: string | undefined;

function publish(next: UpdateState): void {
  state = next;
  getWindowRef()?.webContents.send(IPC.updateState, state);
}

/**
 * Whether this build can update itself at all.
 *
 * `isPackaged` is the honest test: a dev run and a `--dir` unpacked build both
 * lack the `app-update.yml` that electron-builder writes into an installer, and
 * calling the updater without it throws rather than returning a useful answer.
 */
export function updatesSupported(): boolean {
  return app.isPackaged;
}

export function currentUpdateState(): UpdateState {
  return state;
}

export async function checkForUpdates(userInitiated = false): Promise<UpdateState> {
  if (!updatesSupported()) {
    publish({
      status: 'unsupported',
      message: 'Updates apply to the installed app. This is a development build.',
    });
    return state;
  }
  // Don't restart a download that is already running.
  if (state.status === 'downloading' || state.status === 'checking') return state;
  if (state.status === 'ready') return state;

  publish({ status: 'checking' });
  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result) {
      publish({ status: 'idle', message: 'No update information was returned.' });
      return state;
    }
    // `updateInfo.version` is the released version; equal means we are current.
    if (result.updateInfo.version === app.getVersion()) {
      publish({
        status: 'current',
        version: app.getVersion(),
        message: userInitiated ? 'This is the latest version.' : undefined,
      });
    }
    return state;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reach GitHub';
    // Not an error: it is what every copy sees until the first release is
    // published, and calling it a failure would put a red line in the status
    // bar of a perfectly healthy app.
    if (/no published versions/i.test(message)) {
      publish({
        status: 'current',
        version: app.getVersion(),
        message: userInitiated ? 'No releases have been published yet.' : undefined,
      });
      return state;
    }
    publish({ status: 'error', message });
    // A failed check usually means no network or a rate limit; either way,
    // retrying every 30 minutes will not help and may make it worse.
    scheduleChecks(FAILURE_BACKOFF_MS);
    return state;
  }
}

/** Quits and installs. Only meaningful once `status` is `ready`. */
export function installUpdate(): void {
  if (state.status !== 'ready') return;
  // `isSilent: false` shows the installer UI; `isForceRunAfter: true` reopens
  // the app, so the user lands back where they were rather than at a desktop.
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
}

function scheduleChecks(intervalMs: number): void {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    void checkForUpdates();
  }, intervalMs);
  // Never keep the process alive just to check for updates.
  timer.unref?.();
}

export function registerUpdater(getWindow: () => BrowserWindow | null): void {
  getWindowRef = getWindow;

  // Fetch in the background, but never install without being asked.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('update-available', (info) => {
    pendingVersion = info.version;
    publish({ status: 'downloading', version: info.version, percent: 0 });
  });

  autoUpdater.on('update-not-available', () => {
    if (state.status !== 'current') publish({ status: 'current', version: app.getVersion() });
  });

  autoUpdater.on('download-progress', (progress) => {
    publish({
      status: 'downloading',
      version: pendingVersion,
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    pendingVersion = info.version;
    publish({ status: 'ready', version: info.version });
  });

  autoUpdater.on('error', (error) => {
    publish({ status: 'error', message: error?.message ?? 'Update failed' });
  });

  // The first check waits a moment: a cold start is busy enough scanning fonts
  // without a network round trip competing for it.
  setTimeout(() => void checkForUpdates(), 15_000).unref?.();
  scheduleChecks(UPDATE_CHECK_INTERVAL_MS);
}

/** Handler for the menu's "Check for updates" item, which expects an answer. */
export async function checkForUpdatesInteractive(): Promise<void> {
  const window = getWindowRef();
  const result = await checkForUpdates(true);
  if (!window) return;

  if (result.status === 'unsupported' || result.status === 'error') {
    await dialog.showMessageBox(window, {
      type: result.status === 'error' ? 'warning' : 'info',
      message: result.status === 'error' ? 'Could not check for updates' : 'Updates unavailable',
      detail: result.message,
      buttons: ['OK'],
    });
    return;
  }
  if (result.status === 'current') {
    await dialog.showMessageBox(window, {
      type: 'info',
      message: `Embroider Design ${app.getVersion()} is up to date.`,
      buttons: ['OK'],
    });
  }
}
