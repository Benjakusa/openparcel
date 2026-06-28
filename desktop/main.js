const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Point this at your deployed frontend. During development you can set the
// environment variable OPENPARCEL_URL to http://localhost:5173 (Vite dev server).
const FRONTEND_URL = process.env.OPENPARCEL_URL || 'https://openparcel-5f7k.onrender.com';

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 640,
        icon: path.join(__dirname, 'build', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            // Allow sessionStorage so AuthContext can store the JWT
            partition: 'persist:openparcel',
        },
        titleBarStyle: 'default',
        // Show a loading screen while the React app loads
        show: false,
        backgroundColor: '#ffffff',
        title: 'OpenDesk Parcel',
    });

    // Show loading placeholder while the web app boots
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'loading.html'));
    mainWindow.once('ready-to-show', () => mainWindow.show());

    // Once placeholder is shown, navigate to the real app
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.loadURL(FRONTEND_URL);
    });

    // After the React app loads, make window visible and set title
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.setTitle('OpenDesk Parcel');
    });

    // Open external links in the system browser, not inside the app
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // In production don't open devtools. Comment this out during development.
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
