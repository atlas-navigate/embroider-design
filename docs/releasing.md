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

**Pushing the tag is the release.** `.github/workflows/release.yml` runs on any
`v*` tag: it installs, checks the tag against the app's version, runs the engine
tests, builds, and publishes with `electron-builder --publish always`.

1. **Bump the version.** `electron-updater` compares the release's version with
   `packages/app/package.json`'s `version`, so that is the field that matters:

   ```powershell
   npm version 0.5.0 --workspace @embroider-design/app --no-git-tag-version
   ```

   Keep the root `package.json` in step by hand if you want them to match; only
   the app's version is used for update comparisons. The workflow fails the
   build if the tag and that field disagree, because a release whose version
   does not match is one no installed copy will ever offer.

2. **Commit, tag and push:**

   ```powershell
   git commit -am "Ship 0.5.0"
   git push origin main
   git tag v0.5.0
   git push origin v0.5.0
   ```

   The tag is what starts the build. Pushing the commit alone releases nothing.

3. **Watch it, and confirm it is live.** The build takes a few minutes:

   ```powershell
   gh run watch
   gh release view v0.5.0
   ```

   The release must carry three assets:

   | File | Why it matters |
   |---|---|
   | `Embroider-Design-0.5.0-setup.exe` | the installer users download |
   | `latest.yml` | **the file the updater reads** — version, filename, SHA-512 |
   | `*.blockmap` | lets the updater download only the changed parts |

   Without `latest.yml` in the release assets, installed copies will keep
   reporting that they are up to date. If you ever build the installer by hand
   and attach it to a release yourself, attach `latest.yml` too.

   `releaseType: release` in `electron-builder.yml` means the release is created
   already published rather than as a draft — the default would be `draft`.
   Check it anyway, because the updater ignores drafts and prereleases and the
   symptom is silence rather than an error:

   ```powershell
   Invoke-RestMethod 'https://api.github.com/repos/atlas-navigate/embroider-design/releases/latest'
   ```

   If it did come out as a draft, publish it from the GitHub UI or
   `PATCH /repos/:owner/:repo/releases/:id` with `{"draft": false}`.

Within 30 minutes every running copy will notice.

`workflow_dispatch` runs the same build without publishing and attaches the
installer to the run, which is how to check the pipeline still works without
cutting a release.

## The failure this workflow exists to prevent

0.3.0 and 0.4.0 were both versioned, committed and built locally, and neither
was ever uploaded. The releases page kept serving 0.2.0 while `main` was two
minor versions ahead, so every download and every auto-update check got an app
without rotation, without shape and icon deletion and without the icon-sheet
importer — and nothing anywhere reported an error. `v0.4.0` was published by
hand from the already-built artifacts on 2026-07-31; the tag-triggered workflow
landed straight after so a version bump cannot silently fail to ship again.

Two things make that failure quiet, and both are worth remembering: a missing
release looks exactly like "no new version" to the updater, and the version in
`package.json` is a claim about the code, not evidence that anyone shipped it.

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

## Publishing by hand

If CI is unavailable, or an installer is already sitting in
`packages/app/release/` from a local `npm run package`, publish it directly.
`gh` uses your own login, so no token has to be created or stored:

```powershell
gh release create v0.5.0 --target main --title "0.5.0" --notes-file notes.md `
  "packages\app\release\Embroider-Design-0.5.0-setup.exe" `
  "packages\app\release\Embroider-Design-0.5.0-setup.exe.blockmap" `
  "packages\app\release\latest.yml"
```

`electron-builder --publish always` with `$env:GH_TOKEN` set to a token with
`repo` scope does the same thing as part of a build.

Either way: attach **`latest.yml`** as well as the installer, and **do not
rename either file** — the result is then identical from the updater's point of
view. Verify afterwards that the published `latest.yml`'s `sha512` matches the
installer you uploaded, since that is the check `electron-updater` rejects a
download over:

```powershell
$h = Get-FileHash -Algorithm SHA512 packages\app\release\Embroider-Design-0.5.0-setup.exe
[Convert]::ToBase64String(([byte[]] -split ($h.Hash -replace '..', '0x$& ')))
```

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
