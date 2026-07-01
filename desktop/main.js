const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// In production (packaged), the frontend build is copied to resources/frontend-dist
// In development, it's at ../frontend/dist relative to this file
const FRONTEND_BUILD = app.isPackaged
  ? path.join(process.resourcesPath, 'frontend-dist')
  : path.join(__dirname, '..', 'frontend', 'dist');

const API_TARGET = 'https://openparcel-5f7k.onrender.com';
const LOCAL_PORT = 51730;

let mainWindow;
let localServer;

// ─── LOCAL STATIC SERVER + API PROXY ─────────────────────────────────────────
function startLocalServer(done) {
  localServer = http.createServer((req, res) => {
    // Proxy API requests to the Render backend
    if (req.url.startsWith('/api/')) {
      const options = {
        hostname: 'openparcel-5f7k.onrender.com',
        port: 443,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: 'openparcel-5f7k.onrender.com' },
      };
      const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });
      proxyReq.on('error', () => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Server error' }));
      });
      req.pipe(proxyReq);
      return;
    }

    // Serve static files from the frontend build
    let filePath = path.join(FRONTEND_BUILD, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.json': 'application/json',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    };

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // SPA fallback — serve index.html for any non-file route
        fs.readFile(path.join(FRONTEND_BUILD, 'index.html'), (err2, data2) => {
          if (err2) {
            res.writeHead(500);
            res.end('Internal error');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data2);
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });

  localServer.listen(LOCAL_PORT, '127.0.0.1', () => {
    console.log(`Local server running on http://127.0.0.1:${LOCAL_PORT}`);
    done();
  });
}

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
      partition: 'persist:openparcel',
    },
    titleBarStyle: 'default',
    show: false,
    backgroundColor: '#ffffff',
    title: 'OpenDesk Parcel',
  });

  // Show loading splash first
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'loading.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Start local server, then navigate to it once loading splash is displayed
  mainWindow.webContents.once('did-finish-load', () => {
    startLocalServer(() => {
      mainWindow.loadURL(`http://127.0.0.1:${LOCAL_PORT}/`);
    });
  });

  // After the React app loads, set title
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.setTitle('OpenDesk Parcel');
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (localServer) localServer.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
