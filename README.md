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
├── main.js              # Electron main process (window, tray, IPC)
├── preload.js           # Secure bridge between main and web app
├── forge.config.js      # Electron Forge build configuration
├── package.json         # Dependencies and scripts
├── assets/              # App icons
├── .github/workflows/   # CI/CD — auto-build on tag push
└── README.md
```

## How It Works

1. The desktop app loads `https://jutoka.com` in an Electron window
2. A preload script injects `window.__JUTOKA_DESKTOP__ = true` for the web app to detect desktop
3. The web app can call `window.jutokaDesktop.renderVideo(job)` to hand off rendering
4. FFmpeg runs locally with hardware acceleration for fast encoding
5. Rendered files are saved to your local videos folder and synced back to Jutoka cloud

## License

MIT © Jutoka
