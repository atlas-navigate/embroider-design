import { app, BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { IPC, type MenuCommand } from '../shared/ipc-contract.js';
import { checkForUpdatesInteractive } from './updater.js';

/**
 * The application menu.
 *
 * Every item does exactly one thing: send a command to the renderer, which
 * owns the document and therefore owns what "save" means. Main never decides
 * whether a design has unsaved changes.
 */

const HELP_URL = 'https://github.com/atlas-navigate/embroider-design';

export function buildMenu(getWindow: () => BrowserWindow | null): Menu {
  const send = (command: MenuCommand) => (): void => {
    getWindow()?.webContents.send(IPC.menuCommand, command);
  };

  const template: MenuItemConstructorOptions[] = [
    {
      label: '&File',
      submenu: [
        { label: 'New design', accelerator: 'CmdOrCtrl+N', click: send('new') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: send('open') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: send('save') },
        { label: 'Save as…', accelerator: 'CmdOrCtrl+Shift+S', click: send('save-as') },
        { type: 'separator' },
        { label: 'Import image…', accelerator: 'CmdOrCtrl+I', click: send('import-image') },
        { label: 'Open embroidery file…', click: send('import-embroidery') },
        { label: 'Add a font file…', click: send('add-font') },
        { type: 'separator' },
        { label: 'Export to machine file…', accelerator: 'CmdOrCtrl+E', click: send('export') },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: '&Edit',
      submenu: [
        // Deliberately not `role: 'selectAll'`. That role is Chromium's *text*
        // select-all, and having it here meant Ctrl+A was swallowed before the
        // renderer ever saw the key — selecting every layer was impossible.
        { label: 'Select all layers', accelerator: 'CmdOrCtrl+A', click: send('select-all') },
        { label: 'Deselect', accelerator: 'CmdOrCtrl+Shift+A', click: send('deselect') },
        { type: 'separator' },
        { label: 'Group', accelerator: 'CmdOrCtrl+G', click: send('group') },
        { label: 'Ungroup', accelerator: 'CmdOrCtrl+Shift+G', click: send('ungroup') },
        { type: 'separator' },
        { label: 'Duplicate', accelerator: 'CmdOrCtrl+D', click: send('duplicate-layer') },
        { label: 'Delete', accelerator: 'Delete', click: send('delete-layer') },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: '&View',
      submenu: [
        { label: 'Zoom in', accelerator: 'CmdOrCtrl+Plus', click: send('zoom-in') },
        { label: 'Zoom out', accelerator: 'CmdOrCtrl+-', click: send('zoom-out') },
        { label: 'Fit to hoop', accelerator: 'CmdOrCtrl+0', click: send('zoom-fit') },
        { type: 'separator' },
        { label: 'Shapes and icons', accelerator: 'CmdOrCtrl+L', click: send('shapes') },
        {
          label: 'Stitch preview',
          accelerator: 'CmdOrCtrl+P',
          click: send('toggle-preview'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '&Help',
      submenu: [
        {
          label: 'Project page',
          click: () => {
            void shell.openExternal(HELP_URL);
          },
        },
        {
          label: 'Check for updates…',
          click: () => {
            void checkForUpdatesInteractive();
          },
        },
        { type: 'separator' },
        { label: `About Embroider Design ${app.getVersion()}`, click: send('about') },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
