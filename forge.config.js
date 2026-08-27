module.exports = {
  packagerConfig: {
    name: 'Jutoka',
    executableName: 'Jutoka',
    icon: './assets/icon',
    // ffmpeg-static / ffprobe-static ship real OS binaries that must be
    // executed via child_process.spawn. A binary can't be executed while
    // sealed inside app.asar, so it must be unpacked at build time —
    // otherwise every render silently fails with ENOENT once packaged
    // (this never shows up in `npm start`, only in the built installer).
    asar: {
      unpack: '**/node_modules/{ffmpeg-static,ffprobe-static}/**',
    },
    extraResource: [],
    protocols: [
      { name: 'Jutoka Desktop', schemes: ['jutoka-desktop'] }
    ],
    win: {
      target: ['nsis', 'portable'],
      icon: './assets/icon.ico',
    },
    darwin: {
      target: ['dmg', 'zip'],
      icon: './assets/icon.icns',
      category: 'public.app-category.video',
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'Jutoka',
        title: 'Jutoka Desktop',
        authors: 'Jutoka',
        description: 'Professional rendering without browser limits',
        setupIcon: './assets/icon.ico',
        iconUrl: 'https://jutoka.online/favicon.ico',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'Jutoka Desktop',
        title: 'Jutoka Desktop',
      },
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: { owner: 'Gwaveacademy', name: 'jutoka-desktop' },
        prerelease: false,
        draft: false,
      },
    },
  ],
};
