# Jutoka Desktop

Professional rendering without browser limits. Render long videos, large mixes, and 4K exports on your own computer.

## Features

- **Heavy local rendering** — Long videos, large batches, and 4K exports run on your CPU/GPU
- **Smart handoff** — Click "Render on Desktop" in any Jutoka web project to send jobs to the desktop queue
- **One account** — Same login, projects, AI agents, and subscription as the web app
- **System tray integration** — Minimize to tray, monitor render progress
- **FFmpeg-powered** — Hardware-accelerated encoding for fast, high-quality output

## Downloads

Download the latest installer from the [Releases page](../../releases):

- **Windows**: `.exe` installer (Windows 10/11 64-bit)
- **macOS**: `.dmg` file (macOS 12 Monterey or later)

## ⚠️ First launch — important

Jutoka Desktop is not yet code-signed with a paid Apple/Microsoft certificate, so your OS
will warn you the first time you open it. This is normal — just follow the steps below once:

### macOS
1. Open the `.dmg` and drag **Jutoka** into Applications.
2. **Do not double-click it the first time.** Instead, right-click (or Control-click)
   the app in Applications → choose **Open** → click **Open** again in the dialog.
3. If you already tried double-clicking and saw "Jutoka is damaged" or nothing happened:
   go to **System Settings → Privacy & Security**, scroll to the Security section, and
   click **Open Anyway** next to Jutoka.

### Windows
1. Run the `.exe` installer.
2. If **Windows protected your PC** (SmartScreen) appears, click **More info**, then
   **Run anyway**.
3. If your antivirus quarantined the download, restore it from quarantine — this is a
   false positive triggered by the app being unsigned, not malware.

Once code signing is set up (Apple Developer + Windows EV certificate), this step goes away.

## Requirements

- A Jutoka account (free or paid)
- Windows 10/11 64-bit or macOS 12+
- At least 8 GB RAM (16 GB recommended for 4K)
- ~2 GB free disk space
- Internet connection for sign-in and project sync

## Development

```bash
# Install dependencies
npm install

# Run in development
npm start

# Build installers
npm run make

# Build for specific platform
npm run make:win   # Windows .exe
npm run make:mac   # macOS .dmg
```

## Architecture

```
jutoka-desktop/
├── main.js              # Electron main process (window, tray, IPC, crash-safety)
├── preload.js           # Secure bridge between main and web app
├── forge.config.js      # Electron Forge build configuration (icons, asar unpack)
├── package.json         # Dependencies and scripts
├── assets/              # App icons (Jutoka-branded)
├── .github/workflows/   # CI/CD — auto-build on tag push
└── README.md
```

## How It Works

1. The desktop app loads `https://jutoka.com` in an Electron window
2. A preload script injects `window.__JUTOKA_DESKTOP__ = true` for the web app to detect desktop
3. The web app can call `window.jutokaDesktop.renderVideo(job)` to hand off rendering
4. FFmpeg runs locally with hardware acceleration for fast encoding
5. Rendered files are saved to your local videos folder and synced back to Jutoka cloud

### Troubleshooting

- **App won't open at all**: see "First launch — important" above — this is almost always
  an unsigned-app OS warning, not a crash.
- **App opens but the window is blank/stuck**: check your internet connection — v1.0.1+
  shows a retry screen instead of a blank window when `jutoka.com` can't be reached.
- **Crash logs**: saved to your OS user-data folder as `crash.log` (e.g.
  `%APPDATA%/Jutoka/crash.log` on Windows, `~/Library/Application Support/Jutoka/crash.log`
  on macOS) — any main-process error is written there and shown in a dialog.

## License

MIT © Jutoka
