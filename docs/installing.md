# Installing and running Embroider Design

For people who just want to use the software. Nothing here requires Node.js, a
compiler, or any knowledge of the source code.

## What you need

- Windows 10 or Windows 11, **64-bit**
- About 300 MB of disk space
- An internet connection for the download and for automatic updates (the app
  itself works entirely offline once installed)

There is no Python, no runtime, and no separate embroidery-format add-on to buy
or install. Everything is in the one installer.

## Installing

1. Go to the
   [latest release](https://github.com/atlas-navigate/embroider-design/releases/latest)
   and download **`Embroider-Design-<version>-setup.exe`** (about 99 MB).
2. Double-click it.
3. **Windows will warn you.** You will see a blue box saying *"Windows
   protected your PC"*. Click **More info**, then **Run anyway**.

   This is not a sign that something is wrong. Windows shows it for any
   installer that has not been signed with a paid code-signing certificate, and
   this project does not have one yet. Downloading from the releases page above
   is the check that matters — that is the only place official builds come from.
4. Choose an install folder or accept the default,
   `C:\Users\<you>\AppData\Local\Programs\Embroider Design`.

You will not be asked for an administrator password: the app installs for your
user account only. That is deliberate, and it is also what lets updates apply
later without an elevation prompt.

## Running it

Use the **Embroider Design** shortcut on your desktop or in the Start menu.

If you would rather launch it from PowerShell:

```powershell
& "$env:LOCALAPPDATA\Programs\Embroider Design\Embroider Design.exe"
```

## First run

The app opens on an empty hoop. A reasonable first pass:

1. Open the **Shapes** tab and pick something — search for "pumpkin", "snowman"
   or "rings", or browse the categories. Click the canvas to drop it, or drag
   to set its size.
2. Or draw your own with the rectangle or ellipse tool, or press **T** and type
   some text.
3. In the **Settings** tab, pick a stitch type and adjust density. The design
   re-stitches as you change it.
4. Click **Stitch preview** to watch it sew, stitch by stitch, in order.
5. Open the **Hoop** tab and confirm your design fits your machine's hoop.
6. Go to **Export**, choose your machine's format, and save the file.

## Shapes and icons

There are 202 of them: the drawing shapes you would expect from a presentation
tool, and seasonal icons for Halloween, Christmas, Valentine's, weddings,
Easter, Thanksgiving, the 4th of July, birthdays, summer, school, pets, boats
and nature.

Icons made of several pieces — a snowman is body, hat, face, buttons, arms and
a carrot nose — arrive as a **group**, already coloured and in a sensible
sewing order. A group moves, scales and selects as one object. Press
**Ctrl+Shift+G** to split it apart if you want to recolour a piece or delete
one.

## Fonts

The app ships **28 typefaces** and also uses every font already installed on
your PC. The bundled ones lean heavily to cursive — Great Vibes, Allura, Alex
Brush, Parisienne, Sacramento, Italianno, Tangerine, Pacifico and more —
because Windows on its own has almost no script faces: Brush Script and Lucida
Handwriting come with Microsoft Office, not with Windows.

Use the filter chips above the font list to narrow to **Cursive & script**,
Serif, Sans serif, Display or Blackletter. Whichever you pick, the app measures
its actual stroke width at your chosen size and tells you whether it will hold
as satin stitching, and what size would work if it will not. Cursive faces are
thin, so this matters more with them than with anything else.

## Keyboard shortcuts

| Keys | What it does |
|---|---|
| `Ctrl+A` | Select every layer |
| `Ctrl+Shift+A` or `Esc` | Deselect |
| `Ctrl+G` / `Ctrl+Shift+G` | Group / ungroup the selection |
| Arrow keys | Nudge the selection 0.5 mm |
| `Shift` + arrows | Nudge 5 mm |
| `Ctrl+D` / `Delete` | Duplicate / delete the selection |
| `Ctrl+L` | Shapes and icons |
| `Ctrl+P` | Stitch preview |
| `Ctrl+0` | Fit the hoop to the window |
| `V R E P S L F T` | Select, rectangle, ellipse, polygon, star, line, freehand, text |

On the canvas, **Ctrl-click** adds a layer to the selection, **Shift-click**
extends through the stack, and dragging on empty space rubber-bands around
everything it touches. Hold the **space bar** (or use the middle mouse button)
to pan.

## Getting a design onto a Brother PE900

Export as **PES**, copy the file to the **top level** of a FAT32-formatted USB
stick — not inside folders, as the machine does not browse nested directories
reliably — and plug the stick into the machine.

The PE900's hoop is 5" × 7" (127 × 178 mm), it sews at roughly 650 stitches a
minute, and it trims jump stitches for you. The **Hoop** tab has a PE900 preset
that flags anything too large before you get to the machine.

Other machines are supported through DST (Tajima), EXP (Melco), JEF (Janome),
VP3 (Pfaff/Husqvarna) and XXX (Singer). Check your manual for which one your
machine reads.

## Updates

The app checks this project's GitHub releases **every 30 minutes** and downloads
a new version in the background.

It will never restart itself. Digitizing a design is unsaved work, and you may
be halfway through a stitch-out, so when an update is ready the app shows a
banner and waits — you click **Restart** when it suits you, or the update
applies quietly the next time you quit. You can also check on demand from
**Help ▸ Check for updates**.

## Where your files live

- **Designs** are saved wherever you choose, as `.embd` project files. They are
  self-contained: an imported image is stored inside the project, so you can
  reopen and re-trace it without hunting for the original photo.
- **Exported machine files** (`.pes`, `.dst`, …) also go wherever you choose.
- **App settings and the font-scan cache** live in
  `%APPDATA%\Embroider Design`. Deleting that folder resets the app; it does not
  touch your designs.

Uninstalling does not delete your designs or exported files.

## Uninstalling

**Settings ▸ Apps ▸ Installed apps ▸ Embroider Design ▸ Uninstall**, or run
`Uninstall Embroider Design.exe` from the install folder.

## If something goes wrong

| Symptom | Cause and fix |
|---|---|
| "Windows protected your PC" | Expected — the installer is unsigned. **More info ▸ Run anyway**. |
| Your font is missing from the list | The app scans `C:\Windows\Fonts` and your per-user font folder. Use **Add font file…** to point at any other `.ttf` or `.otf`. |
| The bundled cursive fonts are missing | They live in `resources\fonts` inside the install folder. If that folder is empty the installer did not finish; reinstall. |
| A placed icon is one flat colour | You have selected the group and changed its thread. Ungroup with Ctrl+Shift+G to colour the pieces separately. |
| A layer produced no stitches | Usually a shape too small or thin to stitch at the current density. The Layers panel says which layer and why. |
| The machine will not read the file | Confirm the format is one your machine takes, and that the file is at the top level of the USB stick, not in a folder. |
| Updates say "unsupported" | You are running a development build rather than an installed one. Only installed copies update. |

## Before you trust a big design

This software has been built and verified without access to a physical
embroidery machine. The file writers are checked by automated tests and
byte-for-byte fixtures, and the geometry is checked numerically — but none of
that is thread and fabric. **Stitch out a small, cheap test on your own machine
before committing to a large or important design.**
