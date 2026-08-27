const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const store = new Store();
let mainWindow = null;
let tray = null;

const JUTOKA_URL = 'https://jutoka.com';

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

  // Load Jutoka web app
  mainWindow.loadURL(JUTOKA_URL);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('jutoka.com')) {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });

  // Inject desktop detection on page load
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      window.__JUTOKA_DESKTOP__ = true;
      window.__JUTOKA_DESKTOP_VERSION__ = '1.0.0';
      localStorage.setItem('jutoka_desktop', 'true');
    `).catch(() => {});
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
  } catch {
    trayIcon = nativeImage.createEmpty();
  }
  tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Jutoka', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Render Queue', click: () => mainWindow?.webContents.send('navigate', '/render-queue') },
    { label: 'Settings', click: () => mainWindow?.webContents.send('navigate', '/desktop-settings') },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]);

  tray.setToolTip('Jutoka Desktop');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
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
  queue = queue.filter(j => j.id !== jobId);
  store.set('renderQueue', queue);
  return true;
});
ipcMain.handle('desktop:clear-queue', () => {
  store.set('renderQueue', []);
  return true;
});

// Settings
ipcMain.handle('desktop:get-settings', () => store.get('settings', {
  outputDir: path.join(app.getPath('videos'), 'Jutoka'),
  quality: 'high',
  hardwareAccel: true,
  autoStartQueue: true,
  notifications: true,
}));
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
  require('fs').mkdirSync(outputDir, { recursive: true });

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
