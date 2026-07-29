# Releasing and automatic updates

The installed app checks `github.com/atlas-navigate/embroider-design` for a new
release **every 30 minutes**, downloads it in the background, and offers to
restart. This document is how you make a release it can find.

## How the update mechanism works

- `packages/app/src/main/updater.ts` drives `electron-updater`.
- The **publish** block in `packages/app/electron-builder.yml` is what makes it
  possible: at package time electron-builder writes an `app-update.yml` into the
  installer naming the GitHub owner and repo, and `electron-updater` reads that
  file at runtime. **A build made without that block simply cannot self-update**
  — there is nothing for it to read.
- Checks happen 15 seconds after launch, then every 30 minutes. A failed check
  (offline, GitHub rate limit) backs off to every 4 hours rather than retrying
  on the same schedule.
- Downloading is automatic; **installing is not**. Digitizing a design is
  unsaved work, so the app never restarts itself — it shows a banner and waits
  for the user to click, or applies the update the next time they quit.
- Updates only work in a **packaged, installed** build. A `npm run dev` session
  or an unpacked `--dir` build reports `unsupported`, which the UI states
  plainly instead of showing an error.

## Cutting a release

1. **Bump the version.** `electron-updater` compares the release's version with
   `packages/app/package.json`'s `version`, so that is the field that matters:

   ```powershell
   npm version 0.2.0 --workspace @embroider-design/app --no-git-tag-version
   ```

   Keep the root `package.json` in step by hand if you want them to match; only
   the app's version is used for update comparisons.

2. **Build and publish** with a token that can write releases on the repo:

   ```powershell
   $env:GH_TOKEN = "<a token with repo scope>"
   npm run build
   npm run package -w @embroider-design/app -- --publish always
   ```

   That tags `v0.2.0` and uploads three things:

   | File | Why it matters |
   |---|---|
   | `Embroider-Design-0.2.0-setup.exe` | the installer users download |
   | `latest.yml` | **the file the updater reads** — version, filename, SHA-512 |
   | `*.blockmap` | lets the updater download only the changed parts |

   Without `latest.yml` in the release assets, installed copies will keep
   reporting that they are up to date. If you ever build the installer by hand
   and attach it to a release yourself, attach `latest.yml` too.

3. **Confirm it is live.** `releaseType: release` in `electron-builder.yml`
   means the release is created already published rather than as a draft — the
   default would be `draft`. Check it anyway, because the updater ignores drafts
   and prereleases and the symptom is silence rather than an error:

   ```powershell
   Invoke-RestMethod 'https://api.github.com/repos/atlas-navigate/embroider-design/releases/latest'
   ```

   If it did come out as a draft, publish it from the GitHub UI or
   `PATCH /repos/:owner/:repo/releases/:id` with `{"draft": false}`.

Within 30 minutes every running copy will notice.

## Never put a space in the artifact name

`artifactName` in `electron-builder.yml` is deliberately the literal
`Embroider-Design-${version}-setup.${ext}` rather than `${productName}-…`,
because `productName` is "Embroider Design" and the space causes three
different names for one file:

- on disk, electron-builder writes `Embroider Design-0.1.0-setup.exe`
- in `latest.yml`, it writes the sanitized `Embroider-Design-0.1.0-setup.exe`
- if you attach that file to a release by hand, **GitHub renames it again**, to
  `Embroider.Design-0.1.0-setup.exe`

The updater fetches the name in `latest.yml`, so it 404s on every check and the
app silently never updates. `--publish always` happens to paper over this by
uploading under the sanitized name; the manual path does not. A space-free
`artifactName` makes all three identical, so both paths work.

## If you would rather not use a token

`npm run package` alone builds the installer into `packages/app/release/`
without uploading anything. Attach `release/Embroider-Design-<version>-setup.exe`
**and** `release/latest.yml` to a GitHub release manually — do not rename either
file — and the result is identical from the updater's point of view.

## Code signing

The installer is not code signed. Windows SmartScreen will warn on first run
until the certificate builds reputation, and it warns on each update too.
Updates themselves still verify — `electron-updater` checks the SHA-512 in
`latest.yml` against the downloaded file, so a corrupted or substituted
download is rejected whether or not there is a signature.

To sign, set `win.certificateFile` and `win.certificatePassword` (or the
`CSC_LINK` / `CSC_KEY_PASSWORD` environment variables) and rebuild. Do not
commit a certificate or its password.

## Rolling back

Delete or unpublish the bad release on GitHub. `electron-updater` will not
downgrade an already-installed copy, so anyone who already updated has to
install the older version by hand — which is a good reason to keep the previous
installer's release published rather than deleting it.
