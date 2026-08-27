const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const store = new Store();
let mainWindow = null;
let tray = null;

const JUTOKA_URL = 'https://jutoka.com';
const APP_VERSION = app.getVersion();

// --- Crash visibility -------------------------------------------------
// Previously any uncaught error in the main process would kill the app
// with zero feedback to the user ("I open it and nothing happens").
// These handlers make sure a failure is always shown, not silent.
function logToFile(label, err) {
  try {
    const logPath = path.join(app.getPath('userData'), 'crash.log');
    const line = `[${new Date().toISOString()}] ${label}: ${err && err.stack ? err.stack : err}\n`;
    fs.appendFileSync(logPath, line);
  } catch (_) {
    // best effort only
  }
}

process.on('uncaughtException', (err) => {
  logToFile('uncaughtException', err);
  try {
    dialog.showErrorBox(
      'Jutoka Desktop ran into a problem',
      `${err.message || err}\n\nA log was saved to:\n${path.join(app.getPath('userData'), 'crash.log')}`
    );
  } catch (_) {}
});

process.on('unhandledRejection', (err) => {
  logToFile('unhandledRejection', err);
});

// --- Single instance ---------------------------------------------------
// Without this, launching the app while it's already minimized to the
// tray silently does nothing visible instead of surfacing the existing
// window — exactly the "I open it and nothing happens" symptom.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Jutoka Desktop',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
  });

  loadJutoka();

  // Show window as soon as Electron has something to paint — this fires
  // even for an error page, so the user always sees *something* rather
  // than an app that appears to do nothing.
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Safety net: if for any reason ready-to-show never fires (e.g. a
  // renderer crash before first paint), force the window visible after
  // a few seconds so it never just "does nothing".
  const forceShowTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 8000);
  mainWindow.once('ready-to-show', () => clearTimeout(forceShowTimer));

  // If the page fails to load (offline, DNS issue, cert issue, etc.)
  // show a clear retry screen instead of a blank/confusing window.
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return; // ERR_ABORTED — usually a benign redirect/navigation cancel
    logToFile('did-fail-load', `${errorCode} ${errorDescription} (${validatedURL})`);
    mainWindow.loadURL(
      'data:text/html,' +
        encodeURIComponent(`
        <html><body style="font-family:-apple-system,Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;color:#111;">
          <div style="text-align:center;max-width:420px;">
            <h2 style="color:#F28546;">Couldn't reach Jutoka</h2>
            <p>${errorDescription} (${errorCode})</p>
            <p>Check your internet connection, then click retry.</p>
            <button id="retry" style="background:#F28546;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:14px;cursor:pointer;">Retry</button>
          </div>
          <script>
            document.getElementById('retry').onclick = () => location.reload();
          </script>
        </body></html>
      `)
    );
  });

  // Handle external links — open Jutoka links in-app, everything else
  // (e.g. OAuth popups, support links) in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('jutoka.com')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Inject desktop detection on page load so the web app can offer
  // "Render on Desktop" and call window.jutokaDesktop.* APIs.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents
      .executeJavaScript(`
        window.__JUTOKA_DESKTOP__ = true;
        window.__JUTOKA_DESKTOP_VERSION__ = '${APP_VERSION}';
        localStorage.setItem('jutoka_desktop', 'true');
        window.dispatchEvent(new CustomEvent('jutoka-desktop-ready', { detail: { version: '${APP_VERSION}' } }));
      `)
      .catch((err) => logToFile('executeJavaScript', err));
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function loadJutoka() {
  mainWindow.loadURL(JUTOKA_URL).catch((err) => logToFile('loadURL', err));
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
    let trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      // Fall back to the main app icon rather than an empty image, which
      // can throw on some platforms and silently abort tray creation.
      trayIcon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
    }
    tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open Jutoka', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { type: 'separator' },
      { label: 'Render Queue', click: () => mainWindow?.webContents.send('navigate', '/render-queue') },
      { label: 'Settings', click: () => mainWindow?.webContents.send('navigate', '/desktop-settings') },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
    ]);

    tray.setToolTip('Jutoka Desktop');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
  } catch (err) {
    // Tray is a nice-to-have — never let a tray failure take down the app.
    logToFile('createTray', err);
  }
}

// IPC Handlers
ipcMain.handle('desktop:get-version', () => app.getVersion());
ipcMain.handle('desktop:get-platform', () => process.platform);
ipcMain.handle('desktop:get-render-capabilities', async () => {
  return new Promise((resolve) => {
    ffmpeg.ffprobe('/dev/null', (err) => {
      resolve({
        ffmpegAvailable: !err || err.code !== 1,
        ffmpegPath,
        platform: process.platform,
        arch: process.arch,
        cpus: require('os').cpus().length,
        totalMemory: require('os').totalmem(),
      });
    });
  });
});

// Render job handler — receives job from web app
ipcMain.handle('desktop:render-video', async (event, job) => {
  try {
    const result = await renderVideo(job);
    return { success: true, outputUrl: result.outputPath, duration: result.duration };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Render queue handler
ipcMain.handle('desktop:get-queue', () => store.get('renderQueue', []));
ipcMain.handle('desktop:add-to-queue', (event, job) => {
  const queue = store.get('renderQueue', []);
  job.id = Date.now().toString();
  job.status = 'pending';
  job.createdAt = new Date().toISOString();
  queue.push(job);
  store.set('renderQueue', queue);
  return job;
});
ipcMain.handle('desktop:remove-from-queue', (event, jobId) => {
  let queue = store.get('renderQueue', []);
  queue = queue.filter((j) => j.id !== jobId);
  store.set('renderQueue', queue);
  return true;
});
ipcMain.handle('desktop:clear-queue', () => {
  store.set('renderQueue', []);
  return true;
});

// Settings
ipcMain.handle('desktop:get-settings', () =>
  store.get('settings', {
    outputDir: path.join(app.getPath('videos'), 'Jutoka'),
    quality: 'high',
    hardwareAccel: true,
    autoStartQueue: true,
    notifications: true,
  })
);
ipcMain.handle('desktop:set-settings', (event, settings) => {
  store.set('settings', settings);
  return true;
});

// Auth token storage (for syncing with web app)
ipcMain.handle('desktop:set-auth-token', (event, token) => {
  store.set('authToken', token);
  return true;
});
ipcMain.handle('desktop:get-auth-token', () => store.get('authToken', null));
ipcMain.handle('desktop:clear-auth', () => {
  store.delete('authToken');
  return true;
});

// Video rendering using ffmpeg
async function renderVideo(job) {
  const settings = store.get('settings', {});
  const outputDir = settings.outputDir || path.join(app.getPath('videos'), 'Jutoka');
  fs.mkdirSync(outputDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const outputPath = path.join(outputDir, `${job.name || 'render'}_${Date.now()}.mp4`);

    const command = ffmpeg();

    // Add input audio/video sources
    if (job.audioUrl) command.input(job.audioUrl);
    if (job.videoUrl) command.input(job.videoUrl);
    if (job.imageUrl) command.input(job.imageUrl);

    // Video settings
    const quality = settings.quality || 'high';
    const videoBitrate = quality === '4k' ? '8000k' : quality === 'high' ? '4000k' : '2000k';
    const resolution = quality === '4k' ? '3840x2160' : quality === 'high' ? '1920x1080' : '1280x720';

    command
      .outputOptions([
        '-c:v', 'libx264',
        '-preset', settings.hardwareAccel ? 'fast' : 'medium',
        '-b:v', videoBitrate,
        '-s', resolution,
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        console.log('Render started:', cmd);
        if (mainWindow) mainWindow.webContents.send('render:progress', { jobId: job.id, progress: 0, status: 'started' });
      })
      .on('progress', (progress) => {
        if (mainWindow) mainWindow.webContents.send('render:progress', { jobId: job.id, progress: Math.round(progress.percent), status: 'rendering' });
      })
      .on('end', () => {
        if (mainWindow) mainWindow.webContents.send('render:complete', { jobId: job.id, outputPath, status: 'complete' });
        resolve({ outputPath, duration: 0 });
      })
      .on('error', (err) => {
        console.error('Render error:', err);
        if (mainWindow) mainWindow.webContents.send('render:error', { jobId: job.id, error: err.message, status: 'error' });
        reject(err);
      })
      .run();
  });
}

// App lifecycle
if (gotLock) {
  app.whenReady().then(() => {
    createWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
  });
}
